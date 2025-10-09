// doctor-madhusudhan-backend/seed.js
const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
if (!serviceAccountPath) {
    console.error("FIREBASE_SERVICE_ACCOUNT_KEY_PATH is not set in .env. Exiting.");
    process.exit(1);
}

try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK Initialized for seeding.');
} catch (error) {
    console.error('Error initializing Firebase Admin SDK for seeding:', error.message);
    console.error('Ensure FIREBASE_SERVICE_ACCOUNT_KEY_PATH is correct and the JSON file exists.');
    process.exit(1);
}

const db = admin.firestore();

const seedData = async () => {
    try {
        console.log('--- Seeding Firestore Data ---');

        // Check and create Doctor
        let doctorRef;
        const doctorSnapshot = await db.collection('doctors').limit(1).get();
        if (doctorSnapshot.empty) {
            doctorRef = db.collection('doctors').doc();
            await doctorRef.set({
                name: 'Dr Madhusudhan',
                specialization: 'General Physician | Cardiologist',
                experience: 15,
                clinicName: 'Dr. Madhusudhan Clinic',
                address: '123 Healthway, Wellness City, State 45678',
                phoneNumber: '123-456-7890',
                email: 'drmadhusudhan@clinic.com',
                photoUrl: '/doctor-photo.jpg',
                about: 'Dr. Madhusudhan is a highly respected General Physician and Cardiologist with over 15 years of dedicated experience in providing comprehensive healthcare. He is committed to delivering patient-centered care, focusing on preventive health, accurate diagnosis, and effective treatment strategies. His compassionate approach and extensive medical knowledge make him a trusted healthcare provider in the community. He believes in empowering patients with knowledge about their health and working collaboratively to achieve optimal wellness outcomes, ensuring every patient feels heard and cared for.',
            });
            console.log('Dr Madhusudhan created with ID:', doctorRef.id);
        } else {
            doctorRef = doctorSnapshot.docs[0].ref;
            console.log('Dr Madhusudhan already exists with ID:', doctorRef.id);
        }
        const doctorId = doctorRef.id;

        // Check and create Availability
        const availabilitySnapshot = await db.collection('availability').where('doctorId', '==', doctorId).limit(1).get();
        if (availabilitySnapshot.empty) {
            await db.collection('availability').add({
                doctorId: doctorId,
                daySlots: [
                    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
                    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
                ],
            });
            console.log('Doctor availability created.');
        } else {
            console.log('Doctor availability already exists.');
        }

        console.log('--- Seeding Complete ---');
        process.exit();

    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
};

seedData();