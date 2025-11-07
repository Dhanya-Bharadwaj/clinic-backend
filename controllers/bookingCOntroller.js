// doctor-madhusudhan-backend/bookingController.js
const admin = require('firebase-admin');
const { format, isValid, parseISO } = require('date-fns');
const { generateWhatsAppNotifications, generateVideoLinks } = require('../utils/whatsappNotification');
const { sendAppointmentNotifications } = require('../utils/autoWhatsappSender');
const fetch = require('node-fetch');

const db = admin.firestore();

// --- Constants ---
const DOCTOR_PHONE = '8762624188'; // Doctor's WhatsApp number

// --- Firebase Collections ---
const doctorsCollection = db.collection('doctors');
const appointmentsCollection = db.collection('appointments');
const availabilityCollection = db.collection('availability');
const availabilityOverridesCollection = db.collection('availability_overrides');

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
    const { date, consultType } = req.query;

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

    let allDailySlots = [];

    // Check if there is an override for this date and consultType
    const overrideDocId = `${doctorId}_${normalizedDate}_${consultType || 'offline'}`;
    const overrideDoc = await availabilityOverridesCollection.doc(overrideDocId).get();
    if (overrideDoc.exists) {
      const override = overrideDoc.data();
      if (override.closed) {
        return res.status(200).json({ availableSlots: [] });
      }
      if (Array.isArray(override.slots)) {
        allDailySlots = override.slots;
      }
    }

    // Generate slots based on consultation type
  if (!allDailySlots.length && consultType === 'online') {
      // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
      const dayOfWeek = requestDate.getDay();
      
      console.log('Video call consultation requested for day:', dayOfWeek);
      
      if (dayOfWeek === 0 || dayOfWeek === 1) {
        // Sunday (0) or Monday (1): 10:00 AM - 1:00 PM with 15-min slots and 10-min breaks
        // Total cycle: 25 minutes (15 min slot + 10 min break)
        // 10:00-10:15, break, 10:25-10:40, break, 10:50-11:05, break, 11:15-11:30, break, 11:40-11:55, break, 12:05-12:20, break, 12:30-12:45
        allDailySlots = [
          '10:00', '10:25', '10:50', '11:15', '11:40', '12:05', '12:30'
        ];
        console.log('Sunday/Monday video call slots generated:', allDailySlots);
      } else if (dayOfWeek >= 2 && dayOfWeek <= 6) {
        // Tuesday (2) to Saturday (6): Only 2 evening slots
        allDailySlots = ['20:30', '21:00'];
        console.log('Tuesday-Saturday video call slots generated:', allDailySlots);
      } else {
        console.log('No video call slots for this day');
        return res.status(200).json({ availableSlots: [] });
      }
  } else if (!allDailySlots.length) {
      // For in-clinic consultations, check if it's Sunday or Monday (clinic closed)
      const dayOfWeek = requestDate.getDay();
      
      if (dayOfWeek === 0 || dayOfWeek === 1) {
        // Sunday or Monday - Clinic is CLOSED for in-person visits
        console.log('Clinic closed on Sunday/Monday for in-clinic consultations');
        return res.status(200).json({ 
          availableSlots: [],
          message: 'Clinic is closed on Sunday and Monday. Please book a video call consultation instead.'
        });
      }
      
      // For Tuesday-Saturday, use the regular availability from database
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

      allDailySlots = availabilitySnapshot.docs[0].data().daySlots;
    }

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

    // Generate video links for online consultations
    let meetLink = null;
    let jitsiLink = null;
    if (consultType === 'online') {
      const links = generateVideoLinks(appointmentId);
      meetLink = links.meet;
      jitsiLink = links.jitsi;
    }

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

      const appointmentData = {
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
        bookingId: appointmentId
      };

      // Add meetLink only for online consultations
      if (meetLink) appointmentData.meetLink = meetLink;
      if (jitsiLink) appointmentData.jitsiLink = jitsiLink;

      transaction.set(newAppointmentRef, appointmentData);
    });

    // Prepare appointment object for response
    const appointment = {
      id: appointmentId,
      date: normalizedDate,
      time,
      patientName,
      patientPhone,
      age: parseInt(age),
      gender,
      consultType,
      bookingId: appointmentId,
      ...(meetLink && { meetLink }),
      ...(jitsiLink && { jitsiLink })
    };

    // Generate WhatsApp notification data
    const whatsappData = generateWhatsAppNotifications(appointment);

    // 🤖 AUTOMATIC WhatsApp Notifications - BOT MODE!
    // This tries multiple methods automatically: Twilio > Cloud API > CallMeBot
    const patientPhoneNormalized = appointment.patientPhone.startsWith('91') 
      ? appointment.patientPhone 
      : `91${appointment.patientPhone}`;
    
    const doctorPhoneNormalized = `91${DOCTOR_PHONE}`;

    const autoSendResults = await sendAppointmentNotifications(
      patientPhoneNormalized,
      whatsappData.patientMessage,
      doctorPhoneNormalized,
      whatsappData.doctorMessage
    );

    // Return response with automatic send status AND fallback manual links
    return res.status(201).json({
      message: 'Appointment booked successfully!',
      appointment,
      whatsappNotifications: {
        // Automatic send results
        patient: {
          sent: autoSendResults.patient.success,
          method: autoSendResults.patient.method,
          messageId: autoSendResults.patient.messageId,
          fallbackUrl: autoSendResults.patient.manualLink || whatsappData.patientNotificationUrl
        },
        doctor: {
          sent: autoSendResults.doctor.success,
          method: autoSendResults.doctor.method,
          messageId: autoSendResults.doctor.messageId,
          fallbackUrl: autoSendResults.doctor.manualLink || whatsappData.doctorNotificationUrl
        },
        autoSendAttempted: true,
        bothSent: autoSendResults.patient.success && autoSendResults.doctor.success
      }
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

// --- Check Appointments by Phone Number ---
exports.checkAppointmentsByPhone = async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required.' });
    }

    // Get today's date for filtering upcoming appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = format(today, 'yyyy-MM-dd');

    console.log('Checking appointments for phone:', phone);
    console.log('Today date:', todayString);

    // Query appointments by phone number (include both 'booked' and 'booked_online')
    const appointmentsSnapshot = await appointmentsCollection
      .where('patientPhone', '==', phone)
      .where('status', 'in', ['booked', 'booked_online'])
      .get();

    if (appointmentsSnapshot.empty) {
      return res.status(200).json({ appointments: [] });
    }

    // Filter for upcoming appointments (date >= today) and sort by date
    const appointments = appointmentsSnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(appointment => {
        // Compare dates as strings (YYYY-MM-DD format)
        return appointment.date >= todayString;
      })
      .sort((a, b) => {
        // Sort by date, then by time
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }
        return a.time.localeCompare(b.time);
      });

    console.log(`Found ${appointments.length} upcoming appointments`);

    return res.status(200).json({ appointments });

  } catch (error) {
    console.error('Error checking appointments:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// --- Admin: Get availability override for a date ---
exports.getAvailabilityOverride = async (req, res) => {
  try {
    const { date, consultType = 'offline' } = req.query;
    if (!date) return res.status(400).json({ message: 'date is required (YYYY-MM-DD)' });

    const normalizedDate = normalizeDate(date);
    const doctorSnapshot = await doctorsCollection.limit(1).get();
    if (doctorSnapshot.empty) return res.status(404).json({ message: 'Doctor not found.' });
    const doctorId = doctorSnapshot.docs[0].id;

    const id = `${doctorId}_${normalizedDate}_${consultType}`;
    const doc = await availabilityOverridesCollection.doc(id).get();
    if (!doc.exists) return res.json({ override: null });
    return res.json({ override: { id, ...doc.data() } });
  } catch (e) {
    console.error('getAvailabilityOverride error:', e);
    return res.status(500).json({ message: 'Server error', error: e.message });
  }
};

// --- Admin: Upsert availability override ---
exports.upsertAvailabilityOverride = async (req, res) => {
  try {
    const { date, consultType = 'offline', closed = false, slots = [], applyMode = 'once' } = req.body || {};
    if (!date) return res.status(400).json({ message: 'date is required (YYYY-MM-DD)' });
    if (!['online', 'offline'].includes(consultType)) return res.status(400).json({ message: 'consultType must be online or offline' });

    const normalizedDate = normalizeDate(date);
    const doctorSnapshot = await doctorsCollection.limit(1).get();
    if (doctorSnapshot.empty) return res.status(404).json({ message: 'Doctor not found.' });
    const doctorId = doctorSnapshot.docs[0].id;

    // If applyMode is 'always', update the permanent default schedule
    if (applyMode === 'always') {
      if (consultType === 'offline') {
        // Update the availability collection (offline default schedule)
        const availabilitySnapshot = await availabilityCollection
          .where('doctorId', '==', doctorId)
          .limit(1)
          .get();
        
        if (!availabilitySnapshot.empty) {
          const availabilityDoc = availabilitySnapshot.docs[0];
          await availabilityDoc.ref.update({ daySlots: Array.isArray(slots) ? slots : [] });
          return res.status(200).json({ 
            message: 'Default offline schedule updated permanently', 
            mode: 'always',
            slots: slots 
          });
        } else {
          // Create new availability doc if it doesn't exist
          await availabilityCollection.add({
            doctorId,
            daySlots: Array.isArray(slots) ? slots : []
          });
          return res.status(200).json({ 
            message: 'Default offline schedule created', 
            mode: 'always',
            slots: slots 
          });
        }
      } else {
        // Online schedules are hardcoded by day-of-week, cannot be permanently changed
        return res.status(400).json({ 
          message: 'Online consultation schedules are fixed by day of week and cannot be permanently changed. Use "Just for this date" instead.' 
        });
      }
    }

    // Default behavior: one-time override for specific date
    const id = `${doctorId}_${normalizedDate}_${consultType}`;
    const data = { doctorId, date: normalizedDate, consultType, closed: !!closed };
    if (Array.isArray(slots)) data.slots = slots;

    await availabilityOverridesCollection.doc(id).set(data, { merge: true });
    return res.status(200).json({ message: 'Override saved for this date', mode: 'once', override: { id, ...data } });
  } catch (e) {
    console.error('upsertAvailabilityOverride error:', e);
    return res.status(500).json({ message: 'Server error', error: e.message });
  }
};

// --- Admin: Delete availability override ---
exports.deleteAvailabilityOverride = async (req, res) => {
  try {
    const { date, consultType = 'offline' } = req.query;
    if (!date) return res.status(400).json({ message: 'date is required (YYYY-MM-DD)' });
    const normalizedDate = normalizeDate(date);
    const doctorSnapshot = await doctorsCollection.limit(1).get();
    if (doctorSnapshot.empty) return res.status(404).json({ message: 'Doctor not found.' });
    const doctorId = doctorSnapshot.docs[0].id;
    const id = `${doctorId}_${normalizedDate}_${consultType}`;
    await availabilityOverridesCollection.doc(id).delete();
    return res.status(200).json({ message: 'Override deleted', id });
  } catch (e) {
    console.error('deleteAvailabilityOverride error:', e);
    return res.status(500).json({ message: 'Server error', error: e.message });
  }
};

// --- Get Default Slots for a Date (no overrides, no bookings) ---
exports.getDefaultSlotsForDate = async (req, res) => {
  try {
    const { date, consultType } = req.query;
    if (!date) return res.status(400).json({ message: 'Date is required.' });

    const requestDate = new Date(date);
    const normalizedDate = normalizeDate(date);

    const doctorSnapshot = await doctorsCollection.limit(1).get();
    if (doctorSnapshot.empty) {
      return res.status(404).json({ message: 'Doctor not found.' });
    }
    const doctorId = doctorSnapshot.docs[0].id;

    let allDailySlots = [];

    if (consultType === 'online') {
      const dayOfWeek = requestDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 1) {
        allDailySlots = ['10:00', '10:25', '10:50', '11:15', '11:40', '12:05', '12:30'];
      } else if (dayOfWeek >= 2 && dayOfWeek <= 6) {
        allDailySlots = ['20:30', '21:00'];
      } else {
        allDailySlots = [];
      }
    } else {
      const availabilitySnapshot = await availabilityCollection
        .where('doctorId', '==', doctorId)
        .limit(1)
        .get();
      if (!availabilitySnapshot.empty) {
        allDailySlots = availabilitySnapshot.docs[0].data().daySlots || [];
      }
    }

    return res.status(200).json({ date: normalizedDate, consultType: consultType || 'offline', slots: allDailySlots });
  } catch (error) {
    console.error('Error getDefaultSlotsForDate:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};