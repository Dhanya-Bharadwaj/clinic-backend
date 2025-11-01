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
 * Send WhatsApp notification to patient
 */
const sendPatientNotification = (appointment, meetLink) => {
  const { patientName, patientPhone, date, time, bookingId } = appointment;
  
  const message = `✅ *Appointment Confirmed*

Hello ${patientName},

Your online consultation with *Dr. K. Madhusudana* has been confirmed!

📅 *Date:* ${formatDate(date)}
🕐 *Time:* ${formatTime(time)}
🎥 *Meeting Type:* Online Video Consultation
📋 *Booking ID:* ${bookingId}

🔗 *Google Meet Link:*
${meetLink}

*Instructions:*
- Please join the meeting 5 minutes before the scheduled time
- Make sure you have a stable internet connection
- Keep your medical reports ready if any

For any queries, please contact us.

Thank you!
*Dr. K. Madhusudana Clinic*`;

  // URL encode the message
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${patientPhone}?text=${encodedMessage}`;
  
  console.log('Patient WhatsApp notification link generated:', whatsappUrl);
  return whatsappUrl;
};

/**
 * Send WhatsApp notification to doctor
 */
const sendDoctorNotification = (appointment, meetLink) => {
  const { patientName, patientPhone, date, time, bookingId, age, gender } = appointment;
  
  const message = `🔔 *New Online Appointment*

*Patient Details:*
👤 Name: ${patientName}
📞 Phone: ${patientPhone}
👶 Age: ${age} years
⚧ Gender: ${gender.charAt(0).toUpperCase() + gender.slice(1)}

📅 *Date:* ${formatDate(date)}
🕐 *Time:* ${formatTime(time)}
📋 *Booking ID:* ${bookingId}

🔗 *Google Meet Link:*
${meetLink}

*Note:* Patient has been notified with the meeting link.`;

  // URL encode the message
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${DOCTOR_PHONE}?text=${encodedMessage}`;
  
  console.log('Doctor WhatsApp notification link generated:', whatsappUrl);
  return whatsappUrl;
};

/**
 * Generate WhatsApp notification URLs for both doctor and patient
 * Returns an object with patient and doctor notification URLs
 */
const generateWhatsAppNotifications = (appointment) => {
  const meetLink = generateMeetLink(appointment.bookingId || appointment.id);
  
  return {
    meetLink,
    patientNotificationUrl: sendPatientNotification(appointment, meetLink),
    doctorNotificationUrl: sendDoctorNotification(appointment, meetLink)
  };
};

module.exports = {
  generateWhatsAppNotifications,
  generateMeetLink
};
