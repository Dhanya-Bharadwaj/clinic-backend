// doctor-madhusudhan-backend/controllers/paymentsController.js
const Razorpay = require('razorpay');
const crypto = require('crypto');
const admin = require('firebase-admin');
const { format, isValid, parseISO } = require('date-fns');
const { generateWhatsAppNotifications, generateVideoLinks } = require('../utils/whatsappNotification');
const fetch = require('node-fetch');

const db = admin.firestore();
const doctorsCollection = db.collection('doctors');
const appointmentsCollection = db.collection('appointments');
const availabilityCollection = db.collection('availability');

const normalizeDate = (dateString) => {
  try {
    let date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      date = new Date(dateString + 'T00:00:00Z');
    } else {
      date = parseISO(dateString);
    }
    if (!isValid(date)) throw new Error('Invalid date string');
    return format(date, 'yyyy-MM-dd');
  } catch (error) {
    console.error('Error normalizing date in payments:', error.message, dateString);
    throw new Error('Invalid date format for normalization');
  }
};

const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error('Missing Razorpay credentials. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env file.');
  }
  return new Razorpay({ key_id, key_secret });
};

// POST /api/payments/create-order
exports.createOrder = async (req, res) => {
  try {
    const {
      date,
      time,
      patientName,
      patientPhone,
      age,
      gender,
      consultType = 'online',
      amountInINR,
    } = req.body;

    if (!date || !time || !patientName || !patientPhone || !age || !gender) {
      return res.status(400).json({ message: 'Missing required booking fields.' });
    }
    if (consultType !== 'online') {
      return res.status(400).json({ message: 'Online consult required for payment.' });
    }

    const normalizedDate = normalizeDate(date);
    const doctorSnapshot = await doctorsCollection.limit(1).get();
    if (doctorSnapshot.empty) {
      return res.status(404).json({ message: 'Doctor not found.' });
    }
    const doctorId = doctorSnapshot.docs[0].id;

    // For online consultations, we don't validate against availability collection
    // because online slots are generated dynamically based on day of week
    if (consultType === 'offline') {
      // Validate slot is offered for offline consultations only
      const availabilitySnapshot = await availabilityCollection
        .where('doctorId', '==', doctorId)
        .limit(1)
        .get();
      if (availabilitySnapshot.empty || !availabilitySnapshot.docs[0].data().daySlots.includes(time)) {
        return res.status(400).json({ message: 'This time slot is not offered by the doctor.' });
      }
    }

    // Create Razorpay order
    const rzp = getRazorpayInstance();
    const amount = Math.max(1, parseInt((amountInINR ?? process.env.CONSULTATION_FEE_INR ?? '1'), 10)) * 100; // paise

    const options = {
      amount,
      currency: 'INR',
      receipt: 'rcpt_' + Date.now(),
      notes: {
        doctorId,
        date: normalizedDate,
        time,
        patientName,
        patientPhone,
        age: String(age),
        gender,
        consultType,
      },
    };

    const order = await rzp.orders.create(options);
    return res.status(200).json({ order });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return res.status(500).json({ message: 'Failed to create order', error: error.message });
  }
};

// POST /api/payments/verify
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing payment verification fields.' });
    }

    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    const generated_signature = crypto
      .createHmac('sha256', key_secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid payment signature.' });
    }

    const rzp = getRazorpayInstance();
    // Fetch order to obtain booking details from notes
    const order = await rzp.orders.fetch(razorpay_order_id);
    const notes = order.notes || {};
    const { doctorId, date, time, patientName, patientPhone, age, gender } = notes;

    if (!doctorId || !date || !time || !patientName || !patientPhone || !age || !gender) {
      return res.status(400).json({ message: 'Order notes incomplete. Cannot finalize booking.' });
    }

    // Transaction: ensure slot still available and create appointment
    const newAppointmentRef = appointmentsCollection.doc();
    const appointmentId = newAppointmentRef.id;

  // Generate video links for online consultation
  const { jitsi: jitsiLink, meet: meetLink } = generateVideoLinks(appointmentId);

    await db.runTransaction(async (transaction) => {
      const existingAppointmentSnapshot = await transaction.get(
        appointmentsCollection
          .where('doctorId', '==', doctorId)
          .where('date', '==', date)
          .where('time', '==', time)
          .where('status', 'in', ['booked', 'booked_online'])
      );

      if (!existingAppointmentSnapshot.empty) {
        throw new Error('This slot was just booked by someone else. Payment received; please contact support for rescheduling/refund.');
      }

      transaction.set(newAppointmentRef, {
        doctorId,
        patientName,
        patientPhone,
        age: parseInt(age, 10),
        gender,
        consultType: 'online',
        date,
        time,
        status: 'booked_online',
        bookingDate: admin.firestore.FieldValue.serverTimestamp(),
        bookingId: appointmentId,
  meetLink: meetLink, // Store meet link in appointment
  jitsiLink: jitsiLink,
        payment: {
          provider: 'razorpay',
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          signature: razorpay_signature,
          amount: order.amount,
          currency: order.currency,
          status: 'paid',
        },
      });
    });

    // Generate WhatsApp notification URLs
    const appointmentData = {
      id: appointmentId,
      bookingId: appointmentId,
      date,
      time,
      patientName,
      patientPhone,
      age: parseInt(age, 10),
      gender,
      jitsiLink,
      meetLink
    };
    
    const { patientNotificationUrl, doctorNotificationUrl, patientMessage, doctorMessage } = generateWhatsAppNotifications(appointmentData);

    // Attempt automatic WhatsApp send via Cloud API if configured
  const WA_TOKEN = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const WA_PHONE_ID = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
    const WA_API_URL = WA_PHONE_ID ? `https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages` : null;
    const patientPhoneWithCode = appointmentData.patientPhone.startsWith('91') ? appointmentData.patientPhone : `91${appointmentData.patientPhone}`;

    const autoSendResults = { patientSent: false, doctorSent: false };
    if (WA_TOKEN && WA_API_URL) {
      console.log('Attempting WhatsApp auto-send via Cloud API (payments.verify)...');
      try {
        // Send to patient
        const pResp = await fetch(WA_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${WA_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: patientPhoneWithCode,
            type: 'text',
            text: { body: patientMessage }
          })
        });
        autoSendResults.patientSent = pResp.ok;

        // Send to doctor
        const dResp = await fetch(WA_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${WA_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: `91${'8762624188'}`,
            type: 'text',
            text: { body: doctorMessage }
          })
        });
        autoSendResults.doctorSent = dResp.ok;
      } catch (waErr) {
        console.error('WhatsApp auto-send failed (payments.verify):', waErr.message);
      }
    } else {
      console.log('WhatsApp auto-send not configured (payments.verify): Missing WHATSAPP_CLOUD_API_TOKEN or WHATSAPP_CLOUD_PHONE_NUMBER_ID');
    }

    return res.status(200).json({
      message: 'Payment verified and appointment booked successfully!',
      appointment: {
        id: appointmentId,
        date,
        time,
        patientName,
        patientPhone,
        bookingId: appointmentId,
        meetLink: meetLink,
        jitsiLink: jitsiLink,
      },
      whatsappNotifications: {
        patientUrl: patientNotificationUrl,
        doctorUrl: doctorNotificationUrl,
        autoSend: autoSendResults
      }
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({ message: error.message || 'Payment verification failed' });
  }
};
