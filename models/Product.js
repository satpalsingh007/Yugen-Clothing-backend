const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: String,
  reel: String,

  // 👕 allowed sizes list (optional, useful for UI)
  sizes: {
    type: [String],
    default: [],
  },

  // 🔥 stock per size (Map = correct choice)
  stock: {
    type: Map,
    of: Number,
    default: {},
  },

  images: {
    type: [String],
    default: [],
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Product", productSchema);