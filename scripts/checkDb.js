require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
if (!serviceAccountPath) {
    console.error("FIREBASE_SERVICE_ACCOUNT_KEY_PATH is not set in .env");
    process.exit(1);
}

try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK Initialized for checking');
} catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    process.exit(1);
}

const db = admin.firestore();

async function checkDatabase() {
    console.log('\n=== Checking Database State ===\n');

    // Check doctors collection
    console.log('Checking doctors collection...');
    const doctorsSnapshot = await db.collection('doctors').get();
    if (doctorsSnapshot.empty) {
        console.log('❌ No doctors found in database');
    } else {
        console.log('✅ Found doctors:', doctorsSnapshot.size);
        doctorsSnapshot.forEach(doc => {
            console.log(`Doctor ID: ${doc.id}`);
            console.log(doc.data());
        });
    }

    // Check availability collection
    console.log('\nChecking availability collection...');
    const availabilitySnapshot = await db.collection('availability').get();
    if (availabilitySnapshot.empty) {
        console.log('❌ No availability records found');
    } else {
        console.log('✅ Found availability records:', availabilitySnapshot.size);
        availabilitySnapshot.forEach(doc => {
            console.log(`Availability ID: ${doc.id}`);
            console.log(doc.data());
        });
    }

    // Check appointments collection
    console.log('\nChecking appointments collection...');
    const appointmentsSnapshot = await db.collection('appointments').get();
    if (appointmentsSnapshot.empty) {
        console.log('❌ No appointments found');
    } else {
        console.log('✅ Found appointments:', appointmentsSnapshot.size);
        appointmentsSnapshot.forEach(doc => {
            console.log(`Appointment ID: ${doc.id}`);
            console.log(doc.data());
        });
    }

    console.log('\n=== Database Check Complete ===\n');
    process.exit(0);
}

checkDatabase().catch(error => {
    console.error('Error checking database:', error);
    process.exit(1);
});