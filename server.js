const express = require("express");
const cors = require("cors");
const orderAdminRoutes = require("./routes/orderAdmin");
require("dotenv").config();
const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());

// ✅ Routes
app.use("/order", require("./routes/order"));
app.use("/admin", require("./routes/admin"));
app.use("/products", require("./routes/product"));
app.use("/", require("./routes/payment"));
app.use("/orders", orderAdminRoutes);

// ✅ DB
const connectDB = require("./config/db");
connectDB();

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));