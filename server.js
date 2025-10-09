// doctor-madhusudhan-backend/server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const admin = require('firebase-admin');

// Load environment variables
dotenv.config();

// Initialize Firebase Admin SDK
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
if (!serviceAccountPath) {
  console.error("FIREBASE_SERVICE_ACCOUNT_KEY_PATH is not set in .env");
  process.exit(1);
}

try {
  const serviceAccount = require(serviceAccountPath); // Dynamically load the key
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin SDK Initialized Successfully!');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error.message);
  console.error('Make sure FIREBASE_SERVICE_ACCOUNT_KEY_PATH is correct and the JSON file exists.');
  process.exit(1);
}

const db = admin.firestore();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Basic root route
app.get('/', (req, res) => {
  res.send('Doctor Madhusudhan Clinic Backend API (Vercel/Firebase)');
});

// Import and use routes (we'll create this next)
const bookingRoutes = require('./routes/bookingRoutes');
app.use('/api/bookings', bookingRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start the server (for local development only)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} for local development`);
    console.log(`Frontend should access at http://localhost:${PORT}`);
  });
}

// Export the app for Vercel (serverless function entry point)
module.exports = app;