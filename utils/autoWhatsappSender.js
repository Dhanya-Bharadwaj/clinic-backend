// utils/autoWhatsappSender.js
// Automatic WhatsApp Message Sender - Works like a bot!
const fetch = require('node-fetch');

/**
 * Automatically send WhatsApp message using multiple methods
 * Priority: Twilio > Cloud API > CallMeBot > wa.me link
 */

/**
 * Method 1: Twilio WhatsApp API (Recommended - Works immediately after setup)
 */
async function sendViaTwilio(to, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  // BOT number (default fallback) - will be used if TWILIO_WHATSAPP_NUMBER is not configured.
  // User requested bot number: +91 84316 09250
  const DEFAULT_BOT_NUMBER = 'whatsapp:+918431609250';
  const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER || DEFAULT_BOT_NUMBER; // Format: whatsapp:+14155238886

  if (!accountSid || !authToken || !fromWhatsApp) {
    console.log('Twilio not configured');
    return { success: false, method: 'twilio', error: 'Not configured' };
  }

  try {
    const client = require('twilio')(accountSid, authToken);
    
    const toWhatsApp = to.startsWith('whatsapp:') ? to : `whatsapp:+${to}`;
    
    const result = await client.messages.create({
      body: message,
      from: fromWhatsApp,
      to: toWhatsApp
    });

    console.log('✅ Twilio WhatsApp sent:', result.sid);
    return { success: true, method: 'twilio', messageId: result.sid };
  } catch (error) {
    console.error('❌ Twilio failed:', error.message);
    return { success: false, method: 'twilio', error: error.message };
  }
}

/**
 * Method 2: Meta WhatsApp Cloud API
 */
async function sendViaCloudAPI(to, message) {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.log('Cloud API not configured');
    return { success: false, method: 'cloud_api', error: 'Not configured' };
  }

  try {
    const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
    const phoneWithCode = to.startsWith('91') ? to : `91${to}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneWithCode,
        type: 'text',
        text: { body: message }
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Cloud API WhatsApp sent:', result);
      return { success: true, method: 'cloud_api', messageId: result.messages?.[0]?.id };
    } else {
      console.error('❌ Cloud API failed:', result);
      return { success: false, method: 'cloud_api', error: JSON.stringify(result) };
    }
  } catch (error) {
    console.error('❌ Cloud API exception:', error.message);
    return { success: false, method: 'cloud_api', error: error.message };
  }
}

/**
 * Method 3: CallMeBot API (Free, no registration, instant - but limited)
 * Works immediately for Indian numbers!
 */
async function sendViaCallMeBot(to, message) {
  const apiKey = process.env.CALLMEBOT_API_KEY; // User needs to get this by sending "I allow callmebot to send me messages" to +91 93562 31024

  if (!apiKey) {
    console.log('CallMeBot not configured - Visit: https://www.callmebot.com/blog/free-api-whatsapp-messages/');
    return { success: false, method: 'callmebot', error: 'Not configured - Need API key' };
  }

  try {
    // CallMeBot format: phone without +, message, apikey
    const phone = to.replace(/\D/g, ''); // Remove all non-digits
    const encodedMessage = encodeURIComponent(message);
    
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodedMessage}&apikey=${apiKey}`;
    
    const response = await fetch(url);
    const text = await response.text();

    if (text.includes('Message queued') || response.ok) {
      console.log('✅ CallMeBot WhatsApp sent');
      return { success: true, method: 'callmebot' };
    } else {
      console.error('❌ CallMeBot failed:', text);
      return { success: false, method: 'callmebot', error: text };
    }
  } catch (error) {
    console.error('❌ CallMeBot exception:', error.message);
    return { success: false, method: 'callmebot', error: error.message };
  }
}

/**
 * Main function: Try all methods in order until one succeeds
 */
async function sendWhatsAppMessage(to, message, recipientType = 'patient') {
  console.log(`\n🤖 AUTO-SENDING WhatsApp to ${recipientType}: ${to}`);
  console.log('━'.repeat(60));

  // Try methods in priority order
  // Prioritize free option (CallMeBot) first, then Cloud API, then Twilio
  const methods = [
    { name: 'CallMeBot', fn: sendViaCallMeBot },
    { name: 'Cloud API', fn: sendViaCloudAPI },
    { name: 'Twilio', fn: sendViaTwilio }
  ];

  for (const method of methods) {
    console.log(`\n🔄 Trying ${method.name}...`);
    const result = await method.fn(to, message);
    
    if (result.success) {
      console.log(`✅ SUCCESS! Message sent via ${result.method}`);
      console.log('━'.repeat(60));
      return { success: true, method: result.method, messageId: result.messageId };
    } else {
      console.log(`⚠️  ${method.name} failed: ${result.error}`);
    }
  }

  // All methods failed - return wa.me link as fallback
  console.log('\n❌ All automatic methods failed - Fallback to manual link');
  console.log('━'.repeat(60));
  
  const phoneWithCode = to.startsWith('91') ? to : `91${to}`;
  const encodedMessage = encodeURIComponent(message);
  const manualLink = `https://wa.me/${phoneWithCode}?text=${encodedMessage}`;
  
  return { 
    success: false, 
    method: 'manual_link', 
    manualLink,
    error: 'All automatic methods unavailable - configuration needed'
  };
}

/**
 * Send to both patient and doctor automatically
 */
async function sendAppointmentNotifications(patientPhone, patientMessage, doctorPhone, doctorMessage) {
  console.log('\n' + '═'.repeat(60));
  console.log('🚀 AUTOMATIC WHATSAPP NOTIFICATIONS - BOT MODE');
  console.log('═'.repeat(60));

  const results = {
    patient: await sendWhatsAppMessage(patientPhone, patientMessage, 'PATIENT'),
    doctor: await sendWhatsAppMessage(doctorPhone, doctorMessage, 'DOCTOR')
  };

  console.log('\n' + '═'.repeat(60));
  console.log('📊 FINAL RESULTS:');
  console.log(`   Patient: ${results.patient.success ? '✅ SENT' : '❌ FAILED'} (${results.patient.method})`);
  console.log(`   Doctor:  ${results.doctor.success ? '✅ SENT' : '❌ FAILED'} (${results.doctor.method})`);
  console.log('═'.repeat(60) + '\n');

  return results;
}

module.exports = {
  sendWhatsAppMessage,
  sendAppointmentNotifications,
  sendViaTwilio,
  sendViaCloudAPI,
  sendViaCallMeBot
};
