const { generateWhatsAppNotifications } = require('../utils/whatsappNotification');
const { sendAppointmentNotifications } = require('../utils/autoWhatsappSender');

(async () => {
  try {
    // Sample appointment - patientPhone is "whatever given while booking"
    const appointment = {
      id: 'test-appointment-12345',
      bookingId: 'test-appointment-12345',
      patientName: 'Test Patient',
      patientPhone: '9876543210', // sample patient number
      age: 30,
      gender: 'male',
      date: new Date().toISOString(),
      time: '10:30',
      consultType: 'online'
    };

    console.log('\n--- Generating WhatsApp messages (patient + doctor) ---');
    const whatsappData = generateWhatsAppNotifications(appointment);

    console.log('\nWhatsApp generation result:');
    console.log('patientNotificationUrl:', whatsappData.patientNotificationUrl);
    console.log('doctorNotificationUrl:', whatsappData.doctorNotificationUrl);
    console.log('\n--- Message previews ---');
    console.log('\nPatient message:\n', whatsappData.patientMessage.slice(0, 800));
    console.log('\nDoctor message:\n', whatsappData.doctorMessage.slice(0, 800));

    console.log('\n--- Attempting automatic send (will try Twilio, Cloud API, CallMeBot) ---');

    const patientPhoneNormalized = appointment.patientPhone.startsWith('91') ? appointment.patientPhone : `91${appointment.patientPhone}`;
    const doctorPhoneNormalized = `91${'8762624188'}`; // doctor number from utils (prefixed with country code)

    const results = await sendAppointmentNotifications(
      patientPhoneNormalized,
      whatsappData.patientMessage,
      doctorPhoneNormalized,
      whatsappData.doctorMessage
    );

    console.log('\n--- Automatic send results ---');
    console.log(JSON.stringify(results, null, 2));

    console.log('\nIf automatic methods are not configured, open the fallback URLs above to send manually via WhatsApp.');
    process.exit(0);
  } catch (err) {
    console.error('Test script failed:', err);
    process.exit(1);
  }
})();
