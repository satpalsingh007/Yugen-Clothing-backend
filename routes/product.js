const express = require("express");
const router = express.Router();

const Product = require("../models/Product");
const verifyAdmin = require("../middleware/auth");
const upload = require("../middleware/upload");

// -----------------------------
// 🔥 HELPERS
// -----------------------------

const safeJSON = (value, fallback) => {
  if (!value) return fallback;

  try {
    if (typeof value === "string") return JSON.parse(value);
    return value;
  } catch {
    return fallback;
  }
};

const normalizeSizes = (sizes) => {
  const data = safeJSON(sizes, []);
  return Array.isArray(data) ? data : [];
};

const normalizeStock = (stock) => {
  const data = safeJSON(stock, {});

  const clean = {};
  Object.keys(data || {}).forEach((key) => {
    clean[key.toUpperCase()] = Number(data[key]) || 0;
  });

  return clean;
};

// 🔥 IMPORTANT: convert Mongo Map → plain object
const formatProduct = (product) => {
  if (!product) return product;

  const obj = product.toObject();

  return {
    ...obj,
    stock: Object.fromEntries(obj.stock || []),
  };
};

// -----------------------------
// 📦 GET ALL PRODUCTS
// -----------------------------
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    const formatted = products.map(formatProduct);

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// ➕ CREATE PRODUCT
// -----------------------------
router.post("/", verifyAdmin, upload.array("images", 5), async (req, res) => {
  try {
    const images = req.files ? req.files.map((f) => f.path) : [];

    const product = new Product({
      name: req.body.name,
      price: Number(req.body.price),
      description: req.body.description,
      reel: req.body.reel,
      sizes: normalizeSizes(req.body.sizes),
      stock: normalizeStock(req.body.stock),
      images,
    });

    await product.save();

    res.json(formatProduct(product));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// ✏️ UPDATE PRODUCT
// -----------------------------
router.put("/:id", verifyAdmin, upload.array("images", 5), async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      price: Number(req.body.price),
      description: req.body.description,
      reel: req.body.reel,
      sizes: normalizeSizes(req.body.sizes),
      stock: normalizeStock(req.body.stock),
    };

    if (req.files && req.files.length > 0) {
      updateData.images = req.files.map((f) => f.path);
    }

    const updated = await Product.findByIdAndUpdate(req.params.id, updateData, {
      returnDocument: "after",
    });

    if (!updated) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(formatProduct(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// 🗑️ DELETE PRODUCT
// -----------------------------
router.delete("/:id", verifyAdmin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted ✅" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// 🔍 SINGLE PRODUCT
// -----------------------------
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json(formatProduct(product));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
