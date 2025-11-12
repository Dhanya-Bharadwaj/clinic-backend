# Environment & WhatsApp setup

-This file documents the environment variables and quick setup steps needed to enable automatic WhatsApp notifications for bookings.

Summary
- The backend supports three methods (tried in order): CallMeBot (free) -> Meta WhatsApp Cloud API -> Twilio WhatsApp. If none are configured, the server falls back to providing wa.me manual links.
  - We now prioritize CallMeBot (free) so you can send automatic messages without Twilio or Meta setup. CallMeBot requires the recipient to authorize/allow messages and provides an API key.
- Required env vars are described below. For local testing you can set them in PowerShell before running the server or the test script.

Required environment variables


1) CallMeBot (free - recommended)
- CALLMEBOT_API_KEY - CallMeBot API key obtained after authorizing the recipient phone number with CallMeBot

Notes for CallMeBot (free)
- CallMeBot is a free API that can send WhatsApp messages to recipients who have allowed CallMeBot to message them. It's the easiest free option to enable automatic sends.
- How to get your CallMeBot API key:
  1. From the recipient phone (the user who will receive messages), send the message "I allow callmebot to send me messages" to the CallMeBot number listed on their website (instructions: https://www.callmebot.com/blog/free-api-whatsapp-messages/).
  2. After authorizing, CallMeBot provides an API key (on their site or by replying to the user). Copy that key and set it as `CALLMEBOT_API_KEY` in your server environment.
  3. The backend will use this API key to send messages on behalf of CallMeBot.

Important: CallMeBot requires each recipient to authorize the bot before messages can be delivered to them. You can test with your own phone first to verify automatic sends.

2) Meta / WhatsApp Cloud API
- WHATSAPP_CLOUD_API_TOKEN - Long-lived Meta Graph API token for the WhatsApp product
- WHATSAPP_CLOUD_PHONE_NUMBER_ID - Phone number ID (not the E.164 phone number) used in the Graph API URL

Notes: Use this when you have a WhatsApp Business Account and phone number registered with Meta. The payments flow already attempts Cloud API sends when configured.

3) Twilio (optional)
- TWILIO_ACCOUNT_SID - Your Twilio Account SID
- TWILIO_AUTH_TOKEN - Your Twilio Auth Token
- TWILIO_WHATSAPP_NUMBER - The WhatsApp-enabled Twilio number (format: whatsapp:+14155238886 or whatsapp:+918431609250)

Notes: Twilio requires that the "from" WhatsApp number be provisioned in your Twilio account. For quick testing you can use Twilio's WhatsApp sandbox which uses a fixed sandbox number (usually whatsapp:+14155238886). To use the bot phone as the sender (+91 84316 09250), that exact number must be provisioned in Twilio and approved for WhatsApp messaging.

Optional/Related vars
- RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (already used by the payments flow)

Bot fallback number
- The code contains a DEFAULT_BOT_NUMBER fallback used as the Twilio "from" value when TWILIO_WHATSAPP_NUMBER is not set.
- Default bot number in code: +91 84316 09250 (format used by Twilio: whatsapp:+918431609250)
- Important: Providers will reject sends from numbers they don't own. This fallback helps when you control that number in Twilio.

Local PowerShell quick-start examples

# 1) Using Twilio sandbox (recommended for first test)
# Replace the values below with your Twilio account values or use Twilio sandbox docs
$env:TWILIO_ACCOUNT_SID = 'ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
$env:TWILIO_AUTH_TOKEN = 'your_twilio_auth_token'
$env:TWILIO_WHATSAPP_NUMBER = 'whatsapp:+14155238886' # Twilio sandbox number or your provisioned number

# 2) Or using Meta Cloud API (replace with your values)
$env:WHATSAPP_CLOUD_API_TOKEN = 'EAA...'
$env:WHATSAPP_CLOUD_PHONE_NUMBER_ID = '123456789012345'

# 3) Or using CallMeBot (replace with your key)
$env:CALLMEBOT_API_KEY = 'your_callmebot_api_key'

# Run the test script we added (prints generated links and attempts automatic sends):
cd "d:\Dr clinic\doctor-madhusudhan-backend"
node .\scripts\test-whatsapp-send.js

How to test via real booking endpoint

1) Start backend server (ensure env vars are set in the same PowerShell session or system environment):

# Example (depends on how you run your server)
# If you use npm start inside the backend folder
cd "d:\Dr clinic\doctor-madhusudhan-backend"
npm install  # if not already installed
npm start

2) Make a booking POST request (PowerShell example):

$body = @{
  date = (Get-Date).ToString('yyyy-MM-dd')
  time = '10:30'
  patientName = 'Test Patient'
  patientPhone = '9876543210'
  age = 30
  gender = 'male'
  consultType = 'online' # or 'offline'
} | ConvertTo-Json

Invoke-RestMethod -Method Post -ContentType 'application/json' -Body $body -Uri 'http://localhost:3000/api/bookAppointment'

Notes on behavior
- Online bookings (consultType === 'online')
  - The server will attempt to send messages to both the patient and the doctor automatically (Twilio -> Cloud API -> CallMeBot). The response includes `whatsappNotifications` with `patient` and `doctor` results (sent, method, messageId or fallbackUrl).
- Offline bookings (consultType !== 'online')
  - The server will attempt to send only to the patient automatically. Doctor notification is skipped.
- If automatic methods fail, a wa.me fallback URL is returned so you can click to open WhatsApp with pre-filled text.

Provider setup references
- Twilio WhatsApp Sandbox: https://www.twilio.com/docs/whatsapp/sandbox
- WhatsApp Cloud API (Meta): https://developers.facebook.com/docs/whatsapp/cloud-api
- CallMeBot API: https://www.callmebot.com/blog/free-api-whatsapp-messages/

If you want me to also:
- Create an `env.example` file with the variable names in `.env` format (I can add this file next).
- Add a protected endpoint `/dev/trigger-demo-booking` that creates a demo booking and returns the notification result (I can implement it and protect with a secret key).

