// doctor-madhusudhan-backend/routes/paymentsRoutes.js
const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/paymentsController');

// POST /api/payments/create-order
router.post('/create-order', paymentsController.createOrder);

// POST /api/payments/verify
router.post('/verify', paymentsController.verifyPayment);

module.exports = router;
