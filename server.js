// doctor-madhusudhan-backend/server.js - REVISED for Vercel
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const admin = require('firebase-admin');

dotenv.config();

// Firebase Admin SDK Initialization
try {
  let serviceAccountConfig;
  if (process.env.NODE_ENV === 'production' && process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    // In Vercel production, load from Base64 env variable
    const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
    serviceAccountConfig = JSON.parse(decoded);
    console.log("Firebase Admin SDK: Loaded from Base64 environment variable.");
  } else {
    // For local development, load from file path
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
    if (!serviceAccountPath) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY_PATH is not set in .env for local development.");
    }
    serviceAccountConfig = require(serviceAccountPath);
    console.log("Firebase Admin SDK: Loaded from local file.");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountConfig)
  });
  console.log('Firebase Admin SDK Initialized Successfully!');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error.message);
  console.error('Ensure environment variables/file paths are correct.');
  process.exit(1);
}

const db = admin.firestore();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Doctor Madhusudhan Clinic Backend API (Vercel/Firebase)');
});

const bookingRoutes = require('./routes/bookingRoutes');
app.use('/api/bookings', bookingRoutes);

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

module.exports = app; // Export the app for Vercel