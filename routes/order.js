const express = require("express");
const router = express.Router();

const Product = require("../models/Product");
const Order = require("../models/Order"); // (we created earlier)

// 🛒 PLACE ORDER + reduce stock in DB
router.post("/checkout", async (req, res) => {
  try {
    const { cartItems } = req.body;

    for (let item of cartItems) {
      const product = await Product.findById(item._id);

      if (!product) continue;

      const size = item.selectedSize;

      // 🟢 get stock (Mongoose Map)
      const currentStock = product.stock.get(size) || 0;

      if (currentStock < item.quantity) {
        return res.status(400).json({
          message: `Not enough stock for ${product.name} (${size})`,
        });
      }

      // 🔥 reduce stock
      product.stock.set(
        size,
        currentStock - item.quantity
      );

      await product.save();
    }

    res.json({ message: "Order placed + stock updated ✅" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;