// test-seed.js
require('dotenv').config();
const admin = require('firebase-admin');

async function initializeFirebase() {
    try {
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
        console.log('Loading service account from:', serviceAccountPath);
        const serviceAccount = require(serviceAccountPath);
        
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase initialized successfully');
        return admin.firestore();
    } catch (error) {
        console.error('Firebase initialization error:', error);
        throw error;
    }
}

async function seedAndVerifyData() {
    const db = await initializeFirebase();
    
    try {
        console.log('\n=== Seeding and Verifying Data ===\n');

        // 1. Create/Verify Doctor
        console.log('Step 1: Creating/Verifying Doctor...');
        const doctorsCollection = db.collection('doctors');
        let doctorId;
        
        const doctorSnapshot = await doctorsCollection.limit(1).get();
        if (doctorSnapshot.empty) {
            const doctorRef = await doctorsCollection.add({
                name: 'Dr Madhusudhan',
                specialization: 'General Physician | Cardiologist',
                experience: 15,
                clinicName: 'Dr. Madhusudhan Clinic',
                address: '123 Healthway, Wellness City, State 45678',
                phoneNumber: '123-456-7890',
                email: 'drmadhusudhan@clinic.com',
                photoUrl: '/doctor-photo.jpg',
                about: 'Dr. Madhusudhan is a highly respected General Physician and Cardiologist...'
            });
            doctorId = doctorRef.id;
            console.log('✅ Doctor created with ID:', doctorId);
        } else {
            doctorId = doctorSnapshot.docs[0].id;
            console.log('✅ Doctor already exists with ID:', doctorId);
        }

        // 2. Create/Verify Availability
        console.log('\nStep 2: Creating/Verifying Availability...');
        const availabilityCollection = db.collection('availability');
        
        const availabilitySnapshot = await availabilityCollection
            .where('doctorId', '==', doctorId)
            .limit(1)
            .get();

        if (availabilitySnapshot.empty) {
            const availabilityRef = await availabilityCollection.add({
                doctorId: doctorId,
                daySlots: [
                    // Morning session: 10:15 AM - 2:00 PM
                    '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45',
                    '12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45',
                    // Afternoon session: 3:15 PM - 6:00 PM
                    '15:15', '15:30', '15:45', '16:00', '16:15', '16:30', '16:45',
                    '17:00', '17:15', '17:30', '17:45'
                ]
            });
            console.log('✅ Availability created with ID:', availabilityRef.id);
        } else {
            console.log('✅ Availability already exists for doctor');
            console.log('Available slots:', availabilitySnapshot.docs[0].data().daySlots);
        }

        // 3. Verify API Access
        console.log('\nStep 3: Testing Slot Retrieval...');
        const testDate = new Date();
        testDate.setDate(testDate.getDate() + 1); // tomorrow
        const dateString = testDate.toISOString().split('T')[0];
        
        const availabilityDoc = await availabilityCollection
            .where('doctorId', '==', doctorId)
            .limit(1)
            .get();
            
        if (!availabilityDoc.empty) {
            const slots = availabilityDoc.docs[0].data().daySlots;
            console.log(`✅ Available slots for ${dateString}:`, slots);
        } else {
            console.log('❌ No availability found for test date');
        }

    } catch (error) {
        console.error('Error in seedAndVerifyData:', error);
    } finally {
        process.exit(0);
    }
}

seedAndVerifyData();