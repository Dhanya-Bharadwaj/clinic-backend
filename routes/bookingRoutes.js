// doctor-madhusudhan-backend/routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

// Route to seed initial doctor and availability data (run once for setup)
router.post('/seed', bookingController.seedDoctorAndAvailability);

// Route to get general doctor information
router.get('/doctor', bookingController.getDoctorInfo);

// Route to get available slots for a specific date
router.get('/slots', bookingController.getAvailableSlots); // Expects query param ?date=YYYY-MM-DD

// Route to book an appointment
router.post('/', bookingController.bookAppointment);

// Route to mark an appointment as complete (for demo purpose)
router.patch('/:appointmentId/complete', bookingController.markAppointmentComplete);

// Route to get doctor details for about section
router.get('/details', bookingController.getDoctorDetails);

module.exports = router;