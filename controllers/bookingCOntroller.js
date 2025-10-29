// doctor-madhusudhan-backend/controllers/bookingController.js
const admin = require('firebase-admin');
const { format, isValid, parseISO } = require('date-fns');

const db = admin.firestore();

// --- Firebase Collections ---
const doctorsCollection = db.collection('doctors');
const appointmentsCollection = db.collection('appointments');
const availabilityCollection = db.collection('availability');

// Helper function to normalize date to 'YYYY-MM-DD' string for Firestore
const normalizeDate = (dateString) => {
  try {
        let date;
        // Check if it's already in YYYY-MM-DD format (or similar simple format)
        // If not, try to parse it as a full ISO string
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
          date = new Date(dateString + 'T00:00:00Z'); // Treat as UTC start of day for consistency
        } else {
          date = parseISO(dateString);
        }
        if (!isValid(date)) {
          throw new Error('Invalid date string');
        }
        return format(date, 'yyyy-MM-dd');
  } catch (error) {
    console.error("Error normalizing date:", error.message, dateString);
    throw new Error('Invalid date format for normalization');
  }
};


// --- Seed Initial Data (Run Locally Once) ---
// This function will ensure a doctor and their availability exists
// You'd typically run this once locally, not as a deployed endpoint
exports.seedDoctorAndAvailability = async (req, res) => {
  try {
    let doctorDoc;
    const doctorSnapshot = await doctorsCollection.limit(1).get();
    if (doctorSnapshot.empty) {
      doctorDoc = doctorsCollection.doc();
      await doctorDoc.set({
        name: 'Dr Madhusudhan',
        specialization: 'General Physician | Cardiologist',
        experience: 15,
        clinicName: 'Dr. Madhusudhan Clinic',
        address: '123 Healthway, Wellness City, State 45678',
        phoneNumber: '123-456-7890',
        email: 'drmadhusudhan@clinic.com',
        photoUrl: '/doctor-photo.jpg', // Path relative to public folder in frontend
        about: 'Dr. Madhusudhan is a highly respected General Physician and Cardiologist with over 15 years of dedicated experience in providing comprehensive healthcare. He is committed to delivering patient-centered care, focusing on preventive health, accurate diagnosis, and effective treatment strategies. His compassionate approach and extensive medical knowledge make him a trusted healthcare provider in the community. He believes in empowering patients with knowledge about their health and working collaboratively to achieve optimal wellness outcomes, ensuring every patient feels heard and cared for.',
      });
      console.log('Dr Madhusudhan created.');
    } else {
      doctorDoc = doctorSnapshot.docs[0];
      console.log('Dr Madhusudhan already exists.');
    }
    const doctorId = doctorDoc.id;

    const availabilitySnapshot = await availabilityCollection.where('doctorId', '==', doctorId).limit(1).get();
    if (availabilitySnapshot.empty) {
      await availabilityCollection.add({
        doctorId: doctorId,
        daySlots: [
          // Morning session: 10:15 AM - 2:00 PM (last slot at 1:45 PM)
          '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45',
          '12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45',
          // Afternoon session: 3:15 PM - 6:00 PM (last slot at 5:45 PM)
          '15:15', '15:30', '15:45', '16:00', '16:15', '16:30', '16:45',
          '17:00', '17:15', '17:30', '17:45'
        ],
      });
      console.log('Doctor availability created.');
    } else {
      console.log('Doctor availability already exists.');
    }

    return res.status(200).json({ message: 'Doctor and availability seeded successfully' });

  } catch (error) {
    console.error('Error seeding data:', error);
    return res.status(500).json({ message: 'Error seeding data', error: error.message });
  }
};


// --- Get Doctor Information ---
exports.getDoctorInfo = async (req, res) => {
  try {
    const doctorSnapshot = await doctorsCollection.limit(1).get();
    if (doctorSnapshot.empty) {
      return res.status(404).json({ message: 'Doctor not found.' });
    }
    return res.status(200).json(doctorSnapshot.docs[0].data());
  } catch (error) {
    console.error('Error fetching doctor info:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// --- Get Available Slots for a Date ---
exports.getAvailableSlots = async (req, res) => {
  try {
    console.log('=== Starting getAvailableSlots ===');
    console.log('1. Request query:', req.query);
    const { date } = req.query;

    if (!date) {
      console.log('ERROR: No date provided in request');
      return res.status(400).json({ message: 'Date is required.' });
    }

    console.log('2. Validating date:', date);
    // Check if date is in the past
    const requestDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log('Request date:', requestDate.toISOString());
    console.log('Today:', today.toISOString());
    
    if (requestDate < today) {
      return res.status(400).json({ message: 'Cannot book appointments for past dates.' });
    }

    const normalizedDate = normalizeDate(date); // Convert to YYYY-MM-DD

    const doctorSnapshot = await doctorsCollection.limit(1).get();
    if (doctorSnapshot.empty) {
      return res.status(404).json({ message: 'Doctor not found.' });
    }
    const doctorId = doctorSnapshot.docs[0].id;

    const availabilitySnapshot = await availabilityCollection
      .where('doctorId', '==', doctorId)
      .limit(1)
      .get();

    console.log('Availability query result:', {
      empty: availabilitySnapshot.empty,
      doctorId: doctorId,
      hasSlots: availabilitySnapshot.empty ? false : availabilitySnapshot.docs[0].data().daySlots.length > 0
    });

    if (availabilitySnapshot.empty || availabilitySnapshot.docs[0].data().daySlots.length === 0) {
      console.log('No availability found for doctor');
      return res.status(200).json({ availableSlots: [] });
    }

    const allDailySlots = availabilitySnapshot.docs[0].data().daySlots;
    console.log('All daily slots:', allDailySlots);

    const bookedAppointmentsSnapshot = await appointmentsCollection
      .where('doctorId', '==', doctorId)
      .where('date', '==', normalizedDate)
      .where('status', 'in', ['booked'])
      .get();

    const bookedTimes = new Set(bookedAppointmentsSnapshot.docs.map(app => app.data().time));

    let available = allDailySlots.filter(slot => !bookedTimes.has(slot));

    // Filter out past time slots if the selected date is today
    const isToday = requestDate.toDateString() === new Date().toDateString();
    if (isToday) {
      // Get current time in IST (India Standard Time = UTC+5:30)
      const now = new Date();
      const istOffset = 5.5 * 60; // IST is UTC+5:30 in minutes
      const utcTime = now.getTime();
      const istTime = new Date(utcTime + (istOffset * 60 * 1000));
      
      const currentHour = istTime.getUTCHours();
      const currentMinute = istTime.getUTCMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;
      
      console.log(`Today's date selected. Current IST time: ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);
      
      available = available.filter(slot => {
        // Parse slot time (format: "HH:MM" in 24-hour format)
        const [slotHour, slotMinute] = slot.split(':').map(Number);
        const slotTimeInMinutes = slotHour * 60 + slotMinute;
        
        // Only show slots that are at least 15 minutes in the future
        const isAvailable = slotTimeInMinutes > currentTimeInMinutes + 15;
        
        if (!isAvailable) {
          console.log(`Filtering out past slot: ${slot} (${slotTimeInMinutes} minutes vs current ${currentTimeInMinutes} minutes)`);
        }
        
        return isAvailable;
      });
      
      console.log(`Filtered slots for today (after ${currentHour}:${currentMinute.toString().padStart(2, '0')} IST):`, available);
    }

    return res.status(200).json({ availableSlots: available });

  } catch (error) {
    console.error('Error fetching available slots:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// --- Book an Appointment ---
exports.bookAppointment = async (req, res) => {
  try {
    const { date, time, patientName, patientPhone, age, gender, consultType } = req.body;

    if (!date || !time || !patientName || !patientPhone || !age || !gender || !consultType) {
      return res.status(400).json({ message: 'All fields are required: date, time, patientName, patientPhone, age, gender, consultType.' });
    }

    const doctorSnapshot = await doctorsCollection.limit(1).get();
    if (doctorSnapshot.empty) {
      return res.status(404).json({ message: 'Doctor not found.' });
    }
    const doctorId = doctorSnapshot.docs[0].id;

    const normalizedDate = normalizeDate(date);

    const availabilitySnapshot = await availabilityCollection
      .where('doctorId', '==', doctorId)
      .limit(1)
      .get();

    if (availabilitySnapshot.empty || !availabilitySnapshot.docs[0].data().daySlots.includes(time)) {
      return res.status(400).json({ message: 'This time slot is not offered by the doctor.' });
    }

    // Transaction for atomic booking
    const newAppointmentRef = appointmentsCollection.doc(); // Get a reference for the new doc
    const appointmentId = newAppointmentRef.id;

    await db.runTransaction(async (transaction) => {
      // Check for existing booking within the transaction
      const existingAppointmentSnapshot = await transaction.get(
        appointmentsCollection
          .where('doctorId', '==', doctorId)
          .where('date', '==', normalizedDate)
          .where('time', '==', time)
          .where('status', 'in', ['booked'])
      );

      if (!existingAppointmentSnapshot.empty) {
        throw new Error('This slot is already booked. Please choose another time.');
      }

      transaction.set(newAppointmentRef, {
        doctorId,
        patientName,
        patientPhone,
        age: parseInt(age),
        gender,
        consultType,
        date: normalizedDate,
        time,
        status: 'booked',
        bookingDate: admin.firestore.FieldValue.serverTimestamp(),
        bookingId: appointmentId // Use Firestore doc ID as booking ID
      });
    });

    return res.status(201).json({
      message: 'Appointment booked successfully!',
      appointment: {
          id: appointmentId,
          date: normalizedDate,
          time,
          patientName,
          patientPhone,
          age: parseInt(age),
          gender,
          consultType,
          bookingId: appointmentId
      },
    });

  } catch (error) {
    console.error('Error booking appointment:', error);
    let statusCode = 500;
    let errorMessage = 'Server error';
    if (error.message.includes('already booked')) {
      statusCode = 409;
      errorMessage = error.message;
    } else if (error.message.includes('not offered')) {
      statusCode = 400;
      errorMessage = error.message;
    }
    return res.status(statusCode).json({ message: errorMessage, error: error.message });
  }
};


// --- Mark Appointment as Complete (Doctor's Internal Action - for demo) ---
exports.markAppointmentComplete = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    if (!appointmentId) {
      return res.status(400).json({ message: 'Appointment ID is required.' });
    }

    const appointmentRef = appointmentsCollection.doc(appointmentId);
    const appointmentDoc = await appointmentRef.get();

    if (!appointmentDoc.exists) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    const appointmentData = appointmentDoc.data();

    if (appointmentData.status === 'completed') {
      return res.status(200).json({ message: 'Appointment already marked as complete.' });
    }

    await appointmentRef.update({ status: 'completed' });

    return res.status(200).json({
      message: 'Appointment marked as complete.',
      appointment: { ...appointmentData, status: 'completed' }
    });

  } catch (error) {
    console.error('Error marking appointment complete:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// --- Get Doctor Details (for About section etc) ---
exports.getDoctorDetails = async (req, res) => {
  try {
    const doctorSnapshot = await doctorsCollection.limit(1).get();
    if (doctorSnapshot.empty) {
      return res.status(404).json({ message: 'Doctor not found.' });
    }
    return res.status(200).json(doctorSnapshot.docs[0].data());
  } catch (error) {
    console.error('Error fetching doctor details:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};