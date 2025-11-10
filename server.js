require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const compression = require("compression");

const app = express();
const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI;

// ===== Middleware =====
app.use(compression());
app.use(express.json({ limit: "1mb" }));

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
};
app.use(cors(corsOptions));

// ===== Routes - ENSURE THESE ARE DECLARED ONLY ONCE =====
const reportsRoutes = require("./routes/reports");
const teacherRoutes = require("./routes/teacherRoutes");
const updateRoutes = require("./routes/updateRoute");

app.use("/api/reports", reportsRoutes);
app.use("/api", teacherRoutes);
app.use("/api/updates", updateRoutes);

// Health check route
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
  });
});

// ===== Static HTML routes =====
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("/login.html", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("/myclass.html", (req, res) => res.sendFile(path.join(__dirname, "public", "myclass.html")));

app.use(express.static(path.join(__dirname, "public"), {
  maxAge: "7d",
  etag: true,
  lastModified: true
}));

// Fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// ===== MongoDB Connection =====
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 20,
  serverSelectionTimeoutMS: 5000
})
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ===== Start server =====
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
