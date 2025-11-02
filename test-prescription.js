// Test script for prescription API endpoints
const API_BASE = 'http://localhost:5001/api/prescriptions';

async function testPrescriptionAPI() {
  console.log('=== Testing Prescription API ===\n');

  // Test 1: Save a prescription
  console.log('Test 1: Saving a prescription...');
  const prescriptionData = {
    clinicName: 'Balakrishna Clinic',
    clinicAddress: '4th Cross Road, New Bank Colony, Konankunte, Bangalore - 560078',
    doctorName: 'Dr. K. Madhusudana',
    doctorQualification: 'M.B.B.S | F.A.G.E   KMC No. 50635',
    patientName: 'Test Patient',
    patientAge: '35',
    patientGender: 'Male',
    patientPhone: '9876543210',
    items: [
      {
        medicine: 'Paracetamol 500mg',
        days: '5',
        pattern: '101',
        notes: 'After food'
      },
      {
        medicine: 'Amoxicillin 250mg',
        days: '7',
        pattern: '111',
        notes: 'Before food'
      }
    ]
  };

  try {
    const saveResponse = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prescriptionData)
    });
    const saveResult = await saveResponse.json();
    console.log('Save Result:', saveResult);
    console.log('✅ Test 1 passed\n');
  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
    console.log('');
  }

  // Test 2: Fetch prescriptions by phone
  console.log('Test 2: Fetching prescriptions by phone number...');
  try {
    const fetchResponse = await fetch(`${API_BASE}?phone=9876543210`);
    const fetchResult = await fetchResponse.json();
    console.log('Fetch Result:', JSON.stringify(fetchResult, null, 2));
    console.log(`Found ${fetchResult.count || 0} prescriptions`);
    console.log('✅ Test 2 passed\n');
  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
    console.log('');
  }

  // Test 3: Test with invalid phone
  console.log('Test 3: Testing with invalid phone number...');
  try {
    const invalidResponse = await fetch(`${API_BASE}?phone=123`);
    const invalidResult = await invalidResponse.json();
    console.log('Invalid Phone Result:', invalidResult);
    if (invalidResponse.status === 400) {
      console.log('✅ Test 3 passed - Correctly rejected invalid phone\n');
    } else {
      console.log('❌ Test 3 failed - Should have returned 400\n');
    }
  } catch (error) {
    console.error('❌ Test 3 failed:', error.message);
    console.log('');
  }

  console.log('=== All tests completed ===');
}

// Run tests
testPrescriptionAPI().catch(console.error);
