const express = require("express");
const router = express.Router();
const Order = require("../models/order");

// 📦 GET ALL ORDERS (with sorting)
router.get("/", async (req, res) => {
  try {
    const { sort } = req.query;

    let sortOption = { createdAt: -1 }; // default latest first

    if (sort === "oldest") {
      sortOption = { createdAt: 1 };
    }

    const orders = await Order.find().sort(sortOption);

    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
// delete order by id
router.delete("/:id", async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found ❌" });
    }

    res.json({ message: "Order deleted ✅" });
  } catch (err) {
    console.error(err);
    console.log("DELETE ROUTE HIT:", req.params.id);
    res.status(500).json({ error: "Delete failed ❌" });
  }
});

module.exports = router;