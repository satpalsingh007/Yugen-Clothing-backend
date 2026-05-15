// const express = require("express");
// const router = express.Router();
// const razorpay = require("../utils/razorpay");
// const crypto = require("crypto");
// const Product = require("../models/Product");
// const Order = require("../models/Order");

// // ============================
// // 🧾 CREATE ORDER
// // ============================
// router.post("/create-order", async (req, res) => {
//   try {
//     const { amount } = req.body;

//     const options = {
//       amount,
//       currency: "INR",
//       receipt: "receipt_" + Date.now(),
//        payment_capture: 0,
//     };

//     const order = await razorpay.orders.create(options);
//     res.json(order);
//   } catch (err) {
//     console.error("CREATE ORDER ERROR:", err);
//     res.status(500).json({ error: "Order creation failed" });
//   }
// });

// // ============================
// // ✅ VERIFY PAYMENT
// // ============================
// router.post("/verify-payment", async (req, res) => {
//   try {
//     const {
//       razorpay_order_id,
//       razorpay_payment_id,
//       razorpay_signature,
//       cartItems,
//       user,
//     } = req.body;

//     // ============================
//     // 🔐 VERIFY SIGNATURE
//     // ============================
//     const body = razorpay_order_id + "|" + razorpay_payment_id;

//     const expectedSignature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(body)
//       .digest("hex");

//     if (expectedSignature !== razorpay_signature) {
//       return res.status(400).json({
//         message: "Invalid payment ❌",
//       });
//     }

//     let totalAmount = 0;

//     const orderItems = [];

//     // ============================
//     // 📦 PROCESS ITEMS SAFELY
//     // ============================
//     for (const item of cartItems) {
//       const size = item.selectedSize;

//       const sizeKey = `stock.${size}`;

//       // ✅ ATOMIC STOCK UPDATE
//       const updatedProduct = await Product.findOneAndUpdate(
//         {
//           _id: item.productId,

//           // stock must still exist
//           [sizeKey]: {
//             $gte: item.quantity,
//           },
//         },
//         {
//           // reduce stock safely
//           $inc: {
//             [sizeKey]: -item.quantity,
//           },
//         },
//         {
//           new: true,
//         },
//       );

//       // ❌ SOMEONE ELSE BOUGHT IT
//       if (!updatedProduct) {
//         return res.status(400).json({
//           message: `${item.name} (${size}) is sold out`,
//         });
//       }

//       // 📦 SAVE ORDER ITEM
//       orderItems.push({
//         productId: updatedProduct._id,
//         name: updatedProduct.name,
//         size,
//         quantity: item.quantity,
//         price: updatedProduct.price,
//       });

//       totalAmount += updatedProduct.price * item.quantity;
//     }

//     // ============================
//     // 💾 SAVE ORDER
//     // ============================
//     const newOrder = new Order({
//       user,
//       items: orderItems,
//       totalAmount,
//       paymentId: razorpay_payment_id,
//       orderId: razorpay_order_id,
//     });

//     await newOrder.save();

//     // ============================
//     // 🎉 SUCCESS
//     // ============================
//     res.json({
//       message: "Payment verified & order saved ✅",
//     });
//   } catch (err) {
//     console.error("VERIFY ERROR:", err);

//     res.status(500).json({
//       error: err.message,
//     });
//   }
// });

// module.exports = router;
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

    res.status(500).json({
      error: "Order creation failed",
    });
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
      .update(body.toString())
      .digest("hex");

    // ❌ INVALID PAYMENT
    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        message: "Invalid payment signature ❌",
      });
    }

    let totalAmount = 0;

    const orderItems = [];

    let hasShortage = false;

    // ============================
    // 📦 PROCESS ITEMS
    // ============================
    for (const item of cartItems) {
      const product = await Product.findById(item.productId);

      if (!product) continue;

      const size = item.selectedSize;

      const currentStock = product.stock?.[size] ?? 0;

      // ❌ COMPLETELY SOLD OUT
      if (currentStock <= 0) {
        hasShortage = true;

        orderItems.push({
          productId: product._id,
          name: product.name,
          size,
          requestedQuantity: item.quantity,
          fulfilledQuantity: 0,
          price: product.price,
          status: "Sold Out",
        });

        continue;
      }

      // ✅ PARTIAL OR FULL
      const fulfilledQty = Math.min(currentStock, item.quantity);

      // reduce stock
      product.stock[size] = currentStock - fulfilledQty;

      await product.save();

      // shortage happened
      if (fulfilledQty < item.quantity) {
        hasShortage = true;
      }

      orderItems.push({
        productId: product._id,
        name: product.name,
        size,
        requestedQuantity: item.quantity,
        fulfilledQuantity: fulfilledQty,
        price: product.price,
        status: fulfilledQty < item.quantity ? "Partial" : "Confirmed",
      });

      totalAmount += product.price * fulfilledQty;
    }

    // ============================
    // // 💳 CAPTURE PAYMENT
    // // ============================
    // try {
    //   await razorpay.payments.capture(
    //     razorpay_payment_id,
    //     totalAmount * 100,
    //     "INR",
    //   );
    // } catch (captureErr) {
    //   console.error("PAYMENT CAPTURE ERROR:", captureErr);

    //   return res.status(400).json({
    //     message: "Payment authorized but capture failed ❌",
    //   });
    // }

    // ============================
    // 💾 SAVE ORDER
    // ============================
    const newOrder = new Order({
      user,
      items: orderItems,
      totalAmount,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,

      status: hasShortage ? "Partial Fulfilled" : "Paid",
    });

    await newOrder.save();

    // ============================
    // 🎉 SUCCESS
    // ============================
    res.json({
      message: "Payment verified, captured & order saved ✅",
    });
  } catch (err) {
    console.error("VERIFY ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
});

module.exports = router;
