const express = require("express");
const router = express.Router();
const razorpay = require("../utils/razorpay");
const crypto = require("crypto");
const Product = require("../models/Product");
const Order = require("../models/order");

// ============================
// 🧾 CREATE ORDER
// ============================
router.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    const options = {
      amount,
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    };

    const order = await razorpay.orders.create(options);
    res.json(order);

  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    res.status(500).json({ error: "Order creation failed" });
  }
});

// ============================
// ✅ VERIFY PAYMENT
// ============================
router.post("/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      cartItems,
      user,
    } = req.body;

    // 🔐 VERIFY SIGNATURE
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid payment ❌" });
    }

    let totalAmount = 0;
    const orderItems = [];

    // ============================
    // 📦 PROCESS ITEMS
    // ============================
    for (let item of cartItems) {
      const product = await Product.findById(item.productId);

      if (!product) {
  return res.status(400).json({
    message: "Product not found",
  });
}

      const size = item.selectedSize;

      // ✅ SAFE STOCK ACCESS
      const currentStock =
        product.stock instanceof Map
          ? product.stock.get(size) || 0
          : product.stock[size] || 0;

      if (currentStock < item.quantity) {
        return res.status(400).json({
          message: `Not enough stock for ${product.name}`,
        });
      }

      // 🔥 Reduce stock
      if (product.stock instanceof Map) {
        product.stock.set(size, currentStock - item.quantity);
      } else {
        product.stock[size] = currentStock - item.quantity;
      }

      await product.save();

      // 📦 Order item
      orderItems.push({
        productId: product._id,
        name: product.name,
        size,
        quantity: item.quantity,
        price: product.price,
      });

      totalAmount += product.price * item.quantity;
    }

    // ============================
    // 💾 SAVE ORDER
    // ============================
    const newOrder = new Order({
      user,
      items: orderItems,
      totalAmount,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
    });

    await newOrder.save();

    // ============================
    // 🎉 SUCCESS
    // ============================
    res.json({
      message: "Payment verified & order saved ✅",
    });

  } catch (err) {
    console.error("VERIFY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;