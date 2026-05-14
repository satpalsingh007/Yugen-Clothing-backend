const jwt = require("jsonwebtoken");

const verifyAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    console.log("HEADER:", authHeader); // ✅ move inside

    if (!authHeader) {
      return res.status(401).send("No token provided");
    }

    // Expect: "Bearer TOKEN"
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).send("Invalid token format");
    }

    const decoded = jwt.verify(token, "SECRET_KEY");

    console.log("DECODED:", decoded); // ✅ debug

    if (decoded.role !== "admin") {
      return res.status(403).send("Not admin");
    }

    next();
  } catch (err) {
    console.error("AUTH ERROR:", err.message);
    return res.status(401).send("Invalid token");
  }
};

module.exports = verifyAdmin;