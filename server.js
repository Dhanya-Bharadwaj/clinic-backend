// doctor-madhusudhan-backend/server.js - FINAL ROBUST VERSION

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const admin = require('firebase-admin');
// Removed `const path = require('path');` as it's not strictly needed for local `require()`

// Load environment variables immediately
dotenv.config();

// Firebase Admin SDK Initialization
let db; // Declare db globally
try {
  let serviceAccountConfig;
  console.log("Starting Firebase Admin SDK Initialization...");
  console.log("Current NODE_ENV:", process.env.NODE_ENV);
  console.log("FIREBASE_SERVICE_ACCOUNT_BASE64 exists:", !!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64);
  console.log("FIREBASE_SERVICE_ACCOUNT_KEY_PATH exists (local):", !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH);

  // Prioritize loading from Base64 env variable (for Vercel/production)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    console.log("Detected FIREBASE_SERVICE_ACCOUNT_BASE64. Attempting to load Firebase config from it.");
    try {
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
      // console.log("Decoded Base64 string (partial):", decoded.substring(0, 100) + "..."); // Optional: for extreme debug
      serviceAccountConfig = JSON.parse(decoded);
      console.log("Firebase Admin SDK: Successfully parsed Base64 config (production).");
    } catch (decodeError) {
      console.error("Error decoding or parsing FIREBASE_SERVICE_ACCOUNT_BASE64:", decodeError.message);
      throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable. Please check its content.");
    }
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH) {
    // Fallback to loading from local file path (for local development)
    console.log("FIREBASE_SERVICE_ACCOUNT_BASE64 not found. Attempting to load from local file path.");
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
    // For local `require`, a relative path like './your-key.json' is often enough,
    // especially if server.js is at the root. `require` automatically resolves.
    serviceAccountConfig = require(serviceAccountPath); // Use original `require` directly
    console.log("Firebase Admin SDK: Successfully loaded from local file (development).");
  } else {
    // If neither is found, it's a configuration error
    throw new Error("Firebase Service Account key not found. Please set FIREBASE_SERVICE_ACCOUNT_BASE64 (for Vercel) or FIREBASE_SERVICE_ACCOUNT_KEY_PATH (for local .env).");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountConfig)
  });
  console.log('Firebase Admin SDK Initialized Successfully!');
  db = admin.firestore(); // Assign to global db
} catch (error) {
  console.error('CRITICAL ERROR initializing Firebase Admin SDK:', error.message);
  console.error('Stack:', error.stack);
  // Re-throw the error to ensure the process exits/function crashes cleanly
  throw error;
}


const app = express();
const PORT = process.env.PORT || 5001; // Changed to 5001 to avoid conflicts

// Middleware
// Configure CORS with specific options
app.use(cors({
  origin: ['https://clinic-frontend-seven-lyart.vercel.app', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Basic root route
app.get('/', (req, res) => {
  res.send('Doctor Madhusudhan Clinic Backend API (Vercel/Firebase)');
});

// Pass the db instance to routes
// Note: bookingRoutes itself does not need to accept db, but controllers do.
// Controllers directly access `admin.firestore()` from the initialized SDK.

// Import and use routes
const bookingRoutes = require('./routes/bookingRoutes');
const paymentsRoutes = require('./routes/paymentsRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/reviews', reviewRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// For local development, listen on a port. Vercel provides its own server.
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} for local development`);
    console.log(`Frontend should access at http://localhost:${PORT}`);
  });
}

// Export the app for Vercel (serverless function entry point)
module.exports = app;