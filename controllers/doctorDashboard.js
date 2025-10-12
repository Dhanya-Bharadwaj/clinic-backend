const admin = require('firebase-admin');

// Function to get all appointments for doctor's view
exports.getDoctorAppointments = async (req, res) => {
    try {
        console.log('Starting getDoctorAppointments...');
        const { status, startDate, endDate } = req.query;
        const db = admin.firestore();
        
        // Add cache control headers
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Expires', '0');
        res.set('Pragma', 'no-cache');

        console.log('Query parameters:', { status, startDate, endDate });

        // Get doctor ID first
        const doctorSnapshot = await db.collection('doctors').limit(1).get();
        if (doctorSnapshot.empty) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }
        const doctorId = doctorSnapshot.docs[0].id;

        // Build query
        let query = db.collection('appointments')
            .where('doctorId', '==', doctorId)
            .orderBy('date', 'desc');

        // Add status filter if provided and not 'all'
        if (status && status !== 'all') {
            query = query.where('status', '==', status);
        }

        // Get appointments
        const appointmentsSnapshot = await query.get();
        console.log(`Found ${appointmentsSnapshot.size} appointments in database`);

        if (appointmentsSnapshot.empty) {
            return res.status(200).json({
                success: true,
                appointments: [],
                message: 'No appointments found'
            });
        }

        // Map the appointments data
        const appointments = appointmentsSnapshot.docs.map(doc => {
            const data = doc.data();
            console.log('Processing appointment:', { id: doc.id, ...data });
            return {
                _id: doc.id,
                bookingId: doc.id,
                patientName: data.patientName || 'No Name',
                patientEmail: data.patientEmail || 'No Email',
                patientPhone: data.patientPhone || 'No Phone',
                date: data.date,
                time: data.time,
                status: data.status || 'booked',
                symptoms: data.symptoms || '',
                createdAt: data.bookingDate ? data.bookingDate.toDate().toISOString() : null
            };
        });

        // Filter by date range if provided
        let filteredAppointments = appointments;
        if (startDate && endDate) {
            // Parse dates and normalize to YYYY-MM-DD format for comparison
            const start = new Date(startDate);
            const end = new Date(endDate);
            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0];
            
            console.log('Filtering appointments between:', { startStr, endStr });
            
            filteredAppointments = appointments.filter(apt => {
                const aptDateStr = apt.date; // Already in YYYY-MM-DD format
                console.log('Checking appointment date:', aptDateStr);
                return aptDateStr >= startStr && aptDateStr <= endStr;
            });
            
            console.log(`Filtered ${appointments.length} appointments down to ${filteredAppointments.length}`);
        }

        console.log(`Returning ${filteredAppointments.length} appointments after filtering`);
        
        if (filteredAppointments.length === 0) {
            return res.status(200).json({
                success: true,
                appointments: [],
                message: 'No appointments found for the selected criteria'
            });
        }

        return res.status(200).json({
            success: true,
            appointments: filteredAppointments,
            total: filteredAppointments.length
        });

    } catch (error) {
        console.error('Error fetching doctor appointments:', error);
        return res.status(500).json({ 
            success: false,
            message: 'Failed to load appointments. Please try again.',
            error: error.message 
        });
    }
};