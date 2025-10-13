require('dotenv').config();
const admin = require('firebase-admin');

(async () => {
  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
    if (!serviceAccountPath) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY_PATH is not set');
    const serviceAccount = require(serviceAccountPath);
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    const db = admin.firestore();

    console.log('Updating availability daySlots to 15-minute schedule...');

    // Build desired slots
    const toSlots = (start, end) => {
      const slots = [];
      const pad = (n) => String(n).padStart(2, '0');
      const toMin = (h, m) => h * 60 + m;
      const fromMin = (min) => ({ h: Math.floor(min / 60), m: min % 60 });
      let cur = toMin(start.h, start.m);
      const endMin = toMin(end.h, end.m);
      while (cur < endMin) {
        const { h, m } = fromMin(cur);
        slots.push(`${pad(h)}:${pad(m)}`);
        cur += 15;
      }
      return slots;
    };

    const desiredSlots = [
      ...toSlots({ h: 10, m: 15 }, { h: 14, m: 0 }), // 10:15 to 13:45
      ...toSlots({ h: 15, m: 15 }, { h: 18, m: 0 }), // 15:15 to 17:45
    ];

    const availabilityRef = db.collection('availability');
    const snap = await availabilityRef.get();
    if (snap.empty) {
      console.log('No availability documents found.');
    } else {
      const batch = db.batch();
      snap.forEach((doc) => {
        batch.update(doc.ref, { daySlots: desiredSlots });
      });
      await batch.commit();
      console.log('Updated', snap.size, 'availability document(s).');
    }

    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to update availability:', err);
    process.exit(1);
  }
})();
