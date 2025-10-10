// doctor-madhusudhan-backend/routes/bookingRoutes.js

const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

// This route gets the doctor's info and is correctly called by your frontend.
// URL: GET /api/bookings/doctor
router.get('/doctor', bookingController.getDoctorDetails); // Using getDoctorDetails for consistency

// This gets the available time slots for a date.
// URL: GET /api/bookings/slots?date=...
router.get('/slots', bookingController.getAvailableSlots);

// This creates a new appointment.
// URL: POST /api/bookings
router.post('/', bookingController.bookAppointment);

// This marks an appointment as complete.
// URL: PATCH /api/bookings/:appointmentId/complete
router.patch('/:appointmentId/complete', bookingController.markAppointmentComplete);

// You can keep this route for initial setup if you need it.
router.post('/seed', bookingController.seedDoctorAndAvailability);


module.exports = router;