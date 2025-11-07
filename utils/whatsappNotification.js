// utils/whatsappNotification.js
const DOCTOR_PHONE = '8762624188'; // Doctor's WhatsApp number

/**
 * Generate a Google Meet link for the appointment
 * In production, you would integrate with Google Calendar API to create actual meetings
 * For now, we'll generate a unique identifier that can be used
 */
const generateMeetLink = (appointmentId) => {
  // This creates a unique meet link format
  // In production, integrate with Google Calendar API to create real meetings
  const meetCode = `dr-madhusudhan-${appointmentId.substring(0, 8)}`;
  return `https://meet.google.com/${meetCode}`;
};

/**
 * Generate easy video call links: Jitsi (no login, browser-based) and fallback Meet
 */
const generateVideoLinks = (appointmentId) => {
  const safeId = appointmentId.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 20) || 'consult';
  const jitsi = `https://meet.jit.si/DrMadhusudhan-${safeId}`;
  const meet = generateMeetLink(appointmentId);
  return { jitsi, meet };
};

/**
 * Format date to readable format
 */
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-IN', options);
};

/**
 * Format time to 12-hour format
 */
const formatTime = (timeString) => {
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
};

/**
 * Build WhatsApp message text for patient
 */
const buildPatientMessage = (appointment, videoLinks) => {
  const { patientName, patientPhone, date, time, bookingId, consultType } = appointment;
  
  let message = `✅ *Appointment Confirmed*

Hello ${patientName},

Your ${consultType === 'online' ? 'video call consultation' : 'in-clinic appointment'} with *Dr. K. Madhusudana* has been confirmed!

📅 *Date:* ${formatDate(date)}
🕐 *Time:* ${formatTime(time)}
📋 *Booking ID:* ${bookingId}`;

  if (consultType === 'online') {
    message += `
🎥 *Meeting Type:* Video Call Consultation

🔗 *Join via Jitsi (no login required):*
${videoLinks?.jitsi}

🔗 *Join via Google Meet (alternate):*
${videoLinks?.meet}

*Instructions:*
- Please join the meeting 5 minutes before the scheduled time
- Make sure you have a stable internet connection
- Keep your medical reports ready if any`;
  } else {
    message += `
🏥 *Consultation Type:* In-Clinic Visit

📍 *Clinic Address:*
Dr. K. Madhusudana Clinic
SPARSH Hospital Road
Near Anand Nursing Home
Marathahalli, Bangalore - 560037

*Instructions:*
- Please arrive 10 minutes before your appointment time
- Bring any previous medical reports if available
- Note: Clinic is closed on Sunday & Monday`;
  }

  message += `

For any queries, please contact us.

Thank you!
*Dr. K. Madhusudana Clinic*`;

  return { message, patientPhone };
};

/**
 * Build WhatsApp message text for doctor
 */
const buildDoctorMessage = (appointment, videoLinks) => {
  const { patientName, patientPhone, date, time, bookingId, age, gender, consultType } = appointment;
  
  let message = `🔔 *New ${consultType === 'online' ? 'Video Call' : 'In-Clinic'} Appointment*

*Patient Details:*
👤 Name: ${patientName}
📞 Phone: ${patientPhone}
👶 Age: ${age} years
⚧ Gender: ${gender.charAt(0).toUpperCase() + gender.slice(1)}

📅 *Date:* ${formatDate(date)}
🕐 *Time:* ${formatTime(time)}
📋 *Booking ID:* ${bookingId}`;

  if (consultType === 'online') {
    message += `

🔗 *Jitsi Link (no login):*
${videoLinks?.jitsi}

🔗 *Google Meet Link (alt):*
${videoLinks?.meet}

*Note:* Patient has been notified with the meeting link.`;
  } else {
    message += `

🏥 *Consultation Type:* In-Clinic Visit

*Note:* Patient has been notified about the clinic visit.`;
  }

  return { message };
};

/**
 * Generate WhatsApp notification URLs for both doctor and patient
 * Returns an object with patient and doctor notification URLs
 */
const generateWhatsAppNotifications = (appointment) => {
  const { consultType } = appointment;
  
  // Generate video links only for online consultations
  const links = consultType === 'online' 
    ? generateVideoLinks(appointment.bookingId || appointment.id)
    : { jitsi: null, meet: null };
  
  // Build messages
  const { message: patientMessage, patientPhone } = buildPatientMessage(appointment, links);
  const { message: doctorMessage } = buildDoctorMessage(appointment, links);

  // Encode and build wa.me links (fallback/manual sharing)
  const encodedPatient = encodeURIComponent(patientMessage);
  const phoneWithCode = patientPhone.startsWith('91') ? patientPhone : `91${patientPhone}`;
  const patientNotificationUrl = `https://wa.me/${phoneWithCode}?text=${encodedPatient}`;

  const encodedDoctor = encodeURIComponent(doctorMessage);
  const doctorNotificationUrl = `https://wa.me/${DOCTOR_PHONE}?text=${encodedDoctor}`;

  console.log('Patient WhatsApp notification link generated:', patientNotificationUrl);
  console.log('Doctor WhatsApp notification link generated:', doctorNotificationUrl);

  return { meetLink: links.meet, jitsiLink: links.jitsi, patientNotificationUrl, doctorNotificationUrl, patientMessage, doctorMessage };
};

module.exports = {
  generateWhatsAppNotifications,
  generateMeetLink,
  generateVideoLinks,
  buildPatientMessage,
  buildDoctorMessage
};
