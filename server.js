// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
// Add reports routes
const reportsRoutes = require('./routes/reports');
app.use('/api/reports', reportsRoutes);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Routes
const teacherRoutes = require("./routes/teacherRoutes");
app.use("/api", teacherRoutes);

// Explicitly serve login.html for root URL
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Redirect index.html to login.html
app.get("/index.html", (req, res) => {
  res.redirect("/");
});

// Serve frontend fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});