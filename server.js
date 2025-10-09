const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet'); // Add security headers
const rateLimit = require('express-rate-limit'); // Add rate limiting
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Security middleware - Add Helmet for security headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting middleware
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict rate limiting for sensitive endpoints
const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5, // Only 5 attempts per 10 minutes
    message: {
        error: 'Too many authentication attempts',
        retryAfter: '10 minutes'
    },
    skipSuccessfulRequests: true,
});

// Apply general rate limiting
app.use(limiter);

// Enhanced CORS configuration for multiple origins
const allowedOrigins = [
    'http://localhost:3000', // Local development
    'http://localhost:5000', // Local frontend
    'https://your-netlify-site.netlify.app', // Replace with your actual Netlify URL
    'https://your-custom-domain.com', // Replace with your custom domain if any
    process.env.FRONTEND_URL, // From environment variable
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            return callback(null, true);
        } else {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'Content-Type', 
        'Accept',
        'Authorization',
        'X-Requested-With',
        'Access-Control-Allow-Credentials'
    ]
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// REMOVE static file serving since frontend is on Netlify
// app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection with better error handling
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('✅ MongoDB connected successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
})
.catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
});

// MongoDB connection event handlers
mongoose.connection.on('disconnected', () => {
    console.log('⚠️ MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Environment variables endpoint for frontend (be careful with sensitive data)
app.get('/api/config', (req, res) => {
    res.json({
        // Only expose non-sensitive Firebase config
        firebase: {
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
            measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
        },
        apiUrl: process.env.NEXT_PUBLIC_API_URL || `http://localhost:${PORT}`
    });
});

// API Routes with rate limiting
app.use('/api/academic', require('./routes/academic'));
app.use('/api/teachers', authLimiter, require('./routes/teacher')); // Apply auth limiter to teachers
app.use('/api/subjects', require('./routes/subjects'));

// REMOVE HTML serving routes since frontend is on Netlify
// These routes are no longer needed:
// app.get('/', ...)
// app.get('/login', ...)
// app.get('/subject-dashboard', ...)
// etc.

// API Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        message: 'IA-MARKS MANAGEMENT API is running!',
        status: 'active',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        allowedOrigins: process.env.NODE_ENV === 'development' ? allowedOrigins : ['Protected in production']
    });
});

// Root endpoint for API-only backend
app.get('/', (req, res) => {
    res.json({
        message: 'IA-MARKS Management API Server',
        version: '1.0.0',
        documentation: '/api/status',
        health: '/health'
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'API endpoint not found',
        path: req.originalUrl,
        availableEndpoints: [
            '/api/status',
            '/api/config',
            '/api/academic',
            '/api/teachers',
            '/api/subjects'
        ]
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.stack);
    
    // Handle CORS errors specifically
    if (err.message.includes('CORS')) {
        return res.status(403).json({
            success: false,
            error: 'CORS policy violation',
            message: 'Origin not allowed'
        });
    }
    
    res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('⚠️ SIGTERM received, shutting down gracefully');
    mongoose.connection.close(() => {
        console.log('✅ MongoDB connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('⚠️ SIGINT received, shutting down gracefully');
    mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API Server running on http://localhost:${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📡 API Base URL: http://localhost:${PORT}/api`);
    console.log(`🌐 Allowed Origins: ${allowedOrigins.join(', ')}`);
});

// Handle server errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
    } else {
        console.error('❌ Server error:', error);
    }
});

module.exports = app;
