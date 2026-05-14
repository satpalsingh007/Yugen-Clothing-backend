// routes/admin.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if ( email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ role: "admin" }, "SECRET_KEY");
    res.json({ token });
  } else {
    res.status(401).json({ message: "Invalid credentials" });
  }
});

module.exports = router;