const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  user: {
    name: String,
    phone: String,
    address: String,
    pincode: String,
  },

  items: [
    {
      productId: String,
      name: String,
      size: String,
      quantity: Number,
      price: Number,
    },
  ],

  totalAmount: Number,

  paymentId: String,
  orderId: String,

  status: {
    type: String,
    default: "paid",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);