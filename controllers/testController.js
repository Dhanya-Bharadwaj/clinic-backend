// Test endpoint to add a sample appointment
exports.addTestAppointment = async (req, res) => {
    try {
        const db = require('firebase-admin').firestore();
        
        // Create a sample appointment
        const sampleAppointment = {
            patientName: "Test Patient",
            patientEmail: "test@example.com",
            patientPhone: "1234567890",
            date: new Date().toISOString().split('T')[0],
            time: "10:00 AM",
            status: "booked",
            symptoms: "Test symptoms",
            createdAt: new Date().toISOString()
        };

        // Add to database
        const docRef = await db.collection('appointments').add(sampleAppointment);
        
        res.json({
            success: true,
            message: 'Test appointment added successfully',
            appointmentId: docRef.id,
            appointment: sampleAppointment
        });

    } catch (error) {
        console.error('Error adding test appointment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add test appointment',
            error: error.message
        });
    }
};