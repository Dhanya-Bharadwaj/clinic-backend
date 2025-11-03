// reviews controller
const express = require('express');
const { body, validationResult } = require('express-validator');
// Use the initialized firebase-admin instance. server.js initializes the SDK.
const admin = require('firebase-admin');

const router = express.Router();

// Get all reviews with rating >= 3.5
// Get all reviews (admin: all, public: rating >= 3.5)
router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const reviewsRef = db.collection('reviews');
    let snapshot;
    
    if (req.query.all === 'true') {
      // Admin: fetch all reviews (no rating filter)
      snapshot = await reviewsRef.get();
    } else {
      // Public: fetch all reviews and filter in memory to avoid index requirement
      snapshot = await reviewsRef.get();
    }
    
    let reviews = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      // For public, only include reviews with rating > 3
      if (req.query.all === 'true' || data.rating > 3) {
        reviews.push({ id: doc.id, ...data });
      }
    });
    
    // Sort reviews by rating (desc) then createdAt (desc)
    reviews.sort((a, b) => {
      const getTs = (r) => {
        const c = r.createdAt;
        if (!c) return 0;
        if (typeof c.toMillis === 'function') return c.toMillis();
        if (typeof c.seconds === 'number') return c.seconds * 1000 + (c.nanoseconds || 0) / 1e6;
        const d = new Date(c);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      };
      // Sort by rating first (descending)
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      // Then by timestamp (descending)
      return getTs(b) - getTs(a);
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

    const db = admin.firestore();
    const reviewsRef = db.collection('reviews');

    const reviewData = {
      name,
      review,
      rating: parseFloat(rating),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      approved: true, // Auto-approve for now
      ipAddress: req.ip || req.connection.remoteAddress,
      displayOnPublic: rating > 3 // Flag to control public display (4 and 5 stars)
    };

    const docRef = await reviewsRef.add(reviewData);

    // Determine response message based on rating
    const responseMessage = rating > 3 
      ? 'Review submitted successfully'
      : 'Thank you for your feedback. We will work to improve our services.';

    res.status(201).json({
      message: responseMessage,
      reviewId: docRef.id,
      saved: true, // Always true - we're saving all reviews now
      displayOnPublic: rating > 3 // Let frontend know if it will show publicly (4 and 5 stars)
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