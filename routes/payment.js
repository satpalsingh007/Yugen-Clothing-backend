const express = require("express");
const router = express.Router();
const razorpay = require("../utils/razorpay");
const crypto = require("crypto");
const Product = require("../models/Product");
const Order = require("../models/Order");

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

    // ============================
    // 🔐 VERIFY SIGNATURE
    // ============================
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        message: "Invalid payment ❌",
      });
    }

    let totalAmount = 0;

    const orderItems = [];

    // ============================
    // 📦 PROCESS ITEMS SAFELY
    // ============================
    for (const item of cartItems) {
      const size = item.selectedSize;

      const sizeKey = `stock.${size}`;

      // ✅ ATOMIC STOCK UPDATE
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: item.productId,

          // stock must still exist
          [sizeKey]: {
            $gte: item.quantity,
          },
        },
        {
          // reduce stock safely
          $inc: {
            [sizeKey]: -item.quantity,
          },
        },
        {
          new: true,
        },
      );

      // ❌ SOMEONE ELSE BOUGHT IT
      if (!updatedProduct) {
        return res.status(400).json({
          message: `${item.name} (${size}) is sold out`,
        });
      }

      // 📦 SAVE ORDER ITEM
      orderItems.push({
        productId: updatedProduct._id,
        name: updatedProduct.name,
        size,
        quantity: item.quantity,
        price: updatedProduct.price,
      });

      totalAmount += updatedProduct.price * item.quantity;
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

    res.status(500).json({
      error: err.message,
    });
  }
});

module.exports = router;
