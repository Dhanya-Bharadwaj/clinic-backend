// doctor-madhusudhan-backend/routes/prescriptionRoutes.js

const express = require('express');
const router = express.Router();
const {
  savePrescription,
  getPrescriptionsByPhone,
  getPrescriptionById
} = require('../controllers/prescriptionController');

// Save a new prescription
router.post('/', savePrescription);

// Get prescriptions by phone number
router.get('/', getPrescriptionsByPhone);

// Get a specific prescription by ID
router.get('/:id', getPrescriptionById);

module.exports = router;
