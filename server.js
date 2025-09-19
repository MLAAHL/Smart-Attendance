// server.js - Fixed version
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
// Add to your server.js (Express)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Middleware
app.use(cors());
app.use(express.json());

// API Routes BEFORE static files
const teacherRoutes = require("./routes/teacherRoutes");
app.use("/api", teacherRoutes);

// ✅ FIXED: Explicit routes BEFORE static middleware
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/myclass.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "myclass.html"));
});

// ✅ Static files AFTER explicit routes
app.use(express.static(path.join(__dirname, "public")));

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Fallback for unmatched routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
