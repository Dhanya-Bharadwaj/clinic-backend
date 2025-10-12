// Debug route to check database contents
const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

// Debug route to check appointments in database
router.get('/debug/appointments', async (req, res) => {
    try {
        const db = admin.firestore();
        console.log('Checking appointments in database...');

        // Get all appointments
        const appointmentsRef = db.collection('appointments');
        const snapshot = await appointmentsRef.get();

        if (snapshot.empty) {
            console.log('No appointments found in database');
            return res.json({ 
                success: true, 
                message: 'No appointments found',
                appointments: [] 
            });
        }

        const appointments = [];
        snapshot.forEach(doc => {
            appointments.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log(`Found ${appointments.length} appointments:`, appointments);
        res.json({ 
            success: true,
            message: `Found ${appointments.length} appointments`,
            appointments 
        });

    } catch (error) {
        console.error('Debug route error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;