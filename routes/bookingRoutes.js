// doctor-madhusudhan-backend/routes/bookingRoutes.js

const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingCOntroller');
const doctorDashboard = require('../controllers/doctorDashboard');
const paymentsController = require('../controllers/paymentsController');

// Doctor Dashboard routes
router.get('/doctor/appointments', doctorDashboard.getDoctorAppointments);

// Get doctor details (frontend expects /api/bookings/doctor)
router.get('/doctor', bookingController.getDoctorDetails);

// DEBUG route to check database state
router.get('/debug/state', async (req, res) => {
  try {
    const db = require('firebase-admin').firestore();
    console.log('Checking database state...');
    
    // Get all appointments
    const appointmentsSnapshot = await db.collection('appointments').get();
    const appointments = appointmentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    const state = {
      appointmentsCount: appointments.length,
      appointments: appointments,
      doctors: [],
      availability: [],
      appointments: []
    };

    // Get all doctors
    const doctorsSnap = await db.collection('doctors').get();
    state.doctors = doctorsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get all availability
    const availabilitySnap = await db.collection('availability').get();
    state.availability = availabilitySnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get all appointments
    const appointmentsSnap = await db.collection('appointments').get();
    state.appointments = appointmentsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(state);
  } catch (error) {
    console.error('Debug state error:', error);
    res.status(500).json({ error: error.message });
  }
});

// (module export moved to bottom)

// This gets the available time slots for a date.
// URL: GET /api/bookings/slots?date=...
router.get('/slots', bookingController.getAvailableSlots);

// Check appointments by phone number
// URL: GET /api/bookings/check-appointments?phone=...
router.get('/check-appointments', bookingController.checkAppointmentsByPhone);

// This creates a new appointment.
// URL: POST /api/bookings
router.post('/', bookingController.bookAppointment);

// This marks an appointment as complete.
// URL: PATCH /api/bookings/:appointmentId/complete
router.patch('/:appointmentId/complete', bookingController.markAppointmentComplete);

// You can keep this route for initial setup if you need it.
router.post('/seed', bookingController.seedDoctorAndAvailability);

module.exports = router;