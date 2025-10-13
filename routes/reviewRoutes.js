// reviews controller
const express = require('express');
const { body, validationResult } = require('express-validator');
// Use the initialized firebase-admin instance. server.js initializes the SDK.
const admin = require('firebase-admin');

const router = express.Router();

// Get all reviews with rating >= 3.5
router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const reviewsRef = db.collection('reviews');
    
    // Query reviews with rating >= 3.5, ordered by date descending
    const snapshot = await reviewsRef
      .where('rating', '>=', 3.5)
      .orderBy('rating', 'desc')
      .orderBy('createdAt', 'desc')
      .get();

    const reviews = [];
    snapshot.forEach((doc) => {
      reviews.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({ reviews });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ 
      message: 'Failed to fetch reviews',
      error: error.message 
    });
  }
});

// Submit a new review
router.post('/', [
  body('name').trim().isLength({ min: 2, max: 100 }).escape(),
  body('review').trim().isLength({ min: 10, max: 500 }).escape(),
  body('rating').isFloat({ min: 1, max: 5 }),
], async (req, res) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, review, rating } = req.body;

    // Only save reviews with rating >= 3.5
    if (rating < 3.5) {
      return res.status(200).json({
        message: 'Thank you for your feedback. We will work to improve our services.',
        saved: false
      });
    }

    const db = admin.firestore();
    const reviewsRef = db.collection('reviews');

    const reviewData = {
      name,
      review,
      rating: parseFloat(rating),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      approved: true, // Auto-approve for now
      ipAddress: req.ip || req.connection.remoteAddress
    };

    const docRef = await reviewsRef.add(reviewData);

    res.status(201).json({
      message: 'Review submitted successfully',
      reviewId: docRef.id,
      saved: true
    });

  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({
      message: 'Failed to submit review',
      error: error.message
    });
  }
});

// Delete a review (admin only)
router.delete('/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;
    
    // Basic admin check - in production, implement proper admin authentication
    const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_KEY;
    
    if (!isAdmin) {
      return res.status(403).json({
        message: 'Unauthorized. Admin access required.'
      });
    }

    const db = admin.firestore();
    const reviewRef = db.collection('reviews').doc(reviewId);

    // Check if review exists
    const doc = await reviewRef.get();
    if (!doc.exists) {
      return res.status(404).json({
        message: 'Review not found'
      });
    }

    // Delete the review
    await reviewRef.delete();

    res.json({
      message: 'Review deleted successfully',
      reviewId
    });

  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({
      message: 'Failed to delete review',
      error: error.message
    });
  }
});

// Get review statistics
router.get('/stats', async (req, res) => {
  try {
    const db = admin.firestore();
    const reviewsRef = db.collection('reviews');
    
    const snapshot = await reviewsRef.get();
    
    let totalReviews = 0;
    let totalRating = 0;
    let ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    snapshot.forEach((doc) => {
      const data = doc.data();
      totalReviews++;
      totalRating += data.rating;
      ratingDistribution[Math.floor(data.rating)]++;
    });

    const averageRating = totalReviews > 0 ? (totalRating / totalReviews).toFixed(1) : 0;

    res.json({
      totalReviews,
      averageRating: parseFloat(averageRating),
      ratingDistribution
    });

  } catch (error) {
    console.error('Error fetching review stats:', error);
    res.status(500).json({
      message: 'Failed to fetch review statistics',
      error: error.message
    });
  }
});

module.exports = router;