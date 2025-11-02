// doctor-madhusudhan-backend/controllers/prescriptionController.js

const admin = require('firebase-admin');

/**
 * Save a new prescription to Firestore
 * POST /api/prescriptions
 * 
 * Request body:
 * {
 *   clinicName: string,
 *   clinicAddress: string,
 *   doctorName: string,
 *   doctorQualification: string,
 *   patientName: string,
 *   patientAge: string,
 *   patientGender: string,
 *   patientPhone: string,
 *   items: [{
 *     medicine: string,
 *     days: string,
 *     pattern: string,
 *     notes: string
 *   }]
 *   sent?: boolean // optional; when true, marks the prescription as sent to patient
 * }
 */
const savePrescription = async (req, res) => {
  console.log('=== Save Prescription Request ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  try {
    const {
      clinicName,
      clinicAddress,
      doctorName,
      doctorQualification,
      patientName,
      patientAge,
      patientGender,
      patientPhone,
      items,
      sent
    } = req.body;

    // Validate required fields
    if (!patientPhone) {
      return res.status(400).json({
        success: false,
        message: 'Patient phone number is required'
      });
    }

    // Patient name is optional per latest requirement

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one medication item is required'
      });
    }

    // Validate phone number format (10 digits)
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(patientPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number. Must be 10 digits.'
      });
    }

    const db = admin.firestore();
    const prescriptionData = {
      clinicName: clinicName || '',
      clinicAddress: clinicAddress || '',
      doctorName: doctorName || '',
      doctorQualification: doctorQualification || '',
      patientName: patientName || '',
      patientAge: patientAge || '',
      patientGender: patientGender || '',
      patientPhone,
      items,
      sent: !!sent,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    console.log('Saving prescription to Firestore...');
    const prescriptionRef = await db.collection('prescriptions').add(prescriptionData);
    
    console.log('Prescription saved successfully with ID:', prescriptionRef.id);

    res.status(201).json({
      success: true,
      message: 'Prescription saved successfully',
      prescriptionId: prescriptionRef.id
    });

  } catch (error) {
    console.error('Error saving prescription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save prescription',
      error: error.message
    });
  }
};

/**
 * Get prescriptions by phone number
 * GET /api/prescriptions?phone=1234567890
 */
const getPrescriptionsByPhone = async (req, res) => {
  console.log('=== Get Prescriptions by Phone ===');
  console.log('Query params:', req.query);

  try {
    const { phone, sent } = req.query;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Validate phone number format
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number. Must be 10 digits.'
      });
    }

    const db = admin.firestore();
    console.log('Querying Firestore for prescriptions with phone:', phone);

    // To avoid requiring a composite Firestore index in development,
    // we fetch by equality and sort in memory by createdAt desc.
    const snapshot = await db.collection('prescriptions')
      .where('patientPhone', '==', phone)
      .get();

    if (snapshot.empty) {
      console.log('No prescriptions found for phone:', phone);
      return res.status(200).json({
        success: true,
        prescriptions: [],
        message: 'No prescriptions found for this phone number'
      });
    }

    let prescriptions = [];
    snapshot.forEach(doc => {
      prescriptions.push({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore timestamps to ISO strings for JSON serialization
        createdAt: doc.data().createdAt?.toDate().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate().toISOString()
      });
    });

    // Optional filter: only include prescriptions explicitly sent by doctor
    if (typeof sent !== 'undefined') {
      const wantSent = String(sent).toLowerCase() === 'true';
      prescriptions = prescriptions.filter(p => !!p.sent === wantSent);
    }

    // Sort newest first using createdAt (fallback to updatedAt)
    prescriptions.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
      return tb - ta;
    });

    console.log(`Found ${prescriptions.length} prescriptions for phone:`, phone);

    res.status(200).json({
      success: true,
      prescriptions,
      count: prescriptions.length
    });

  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch prescriptions',
      error: error.message
    });
  }
};

/**
 * Get a single prescription by ID
 * GET /api/prescriptions/:id
 */
const getPrescriptionById = async (req, res) => {
  console.log('=== Get Prescription by ID ===');
  console.log('Prescription ID:', req.params.id);

  try {
    const { id } = req.params;

    const db = admin.firestore();
    const doc = await db.collection('prescriptions').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    const prescription = {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString(),
      updatedAt: doc.data().updatedAt?.toDate().toISOString()
    };

    res.status(200).json({
      success: true,
      prescription
    });

  } catch (error) {
    console.error('Error fetching prescription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch prescription',
      error: error.message
    });
  }
};

module.exports = {
  savePrescription,
  getPrescriptionsByPhone,
  getPrescriptionById
};
