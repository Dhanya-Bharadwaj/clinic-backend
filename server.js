// doctor-madhusudhan-backend/server.js - ULTRA-ROBUST FIREBASE INIT FOR VERCEL

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const admin = require('firebase-admin');

// Load environment variables immediately
dotenv.config();

// Firebase Admin SDK Initialization
let db; // Declare db globally
try {
  let serviceAccountConfig;
  console.log("STARTING APP INIT: Vercel/Local Check");
  console.log("process.env.NODE_ENV:", process.env.NODE_ENV);
  console.log("process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 length:", process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ? process.env.FIREBASE_SERVICE_ACCOUNT_BASE64.length : 'undefined');
  console.log("process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH exists:", !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH);


  // STRONGLY prioritize loading from Base64 env variable (for Vercel/production)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    console.log("VERCEL MODE: Attempting to load Firebase config from FIREBASE_SERVICE_ACCOUNT_BASE64.");
    try {
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
      serviceAccountConfig = JSON.parse(decoded);
      console.log("VERCEL MODE: Successfully parsed Firebase config from Base64 env var.");
    } catch (decodeError) {
      console.error("CRITICAL VERCEL ERROR: Decoding/Parsing FIREBASE_SERVICE_ACCOUNT_BASE64 failed:", decodeError.message);
      throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable. Check Vercel project settings.");
    }
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH) {
    // Fallback for LOCAL DEVELOPMENT using a file path
    console.log("LOCAL MODE: FIREBASE_SERVICE_ACCOUNT_BASE64 not found. Attempting to load from local file path.");
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
    try {
      // Use original `require` directly for local file
      serviceAccountConfig = require(serviceAccountPath);
      console.log("LOCAL MODE: Successfully loaded Firebase config from local file.");
    } catch (localFileError) {
      console.error("CRITICAL LOCAL ERROR: Could not load Firebase config from local file path:", localFileError.message);
      throw new Error(`Local Firebase key file not found or invalid at: ${serviceAccountPath}`);
    }
  } else {
    // Absolute failure: neither production nor local config is found
    console.error("CRITICAL ERROR: No Firebase Service Account configuration found.");
    throw new Error("Firebase Service Account config is missing. Set FIREBASE_SERVICE_ACCOUNT_BASE64 on Vercel or FIREBASE_SERVICE_ACCOUNT_KEY_PATH in local .env.");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountConfig)
  });
  console.log('Firebase Admin SDK Initialized Successfully!');
  db = admin.firestore(); // Assign to global db for controllers
} catch (error) {
  console.error('GLOBAL CRITICAL ERROR: Firebase Admin SDK initialization failed:', error.message);
  console.error('Stack trace for initialization failure:', error.stack);
  // Re-throw the error to ensure the serverless function crashes and logs the error.
  throw error;
}


const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Basic root route
app.get('/', (req, res) => {
  res.send('Doctor Madhusudhan Clinic Backend API (Vercel/Firebase)');
});

// Import and use routes
const bookingRoutes = require('./routes/bookingRoutes');
app.use('/api/bookings', bookingRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled API Error:', err.stack);
  res.status(500).send('Something broke on the server!');
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