/**
 * routes/reviews.js
 * Product Reviews — GET / POST / DELETE
 * Mounted at /api/products (handles /:id/reviews)
 */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Order  = require('../models/Order');
const requireCustomer = require('../middleware/customerAuth');
const requireAdmin    = require('../middleware/auth');

// ── GET /api/products/:id/reviews ─────────────────────────────────────────────
// Public. Returns reviews, averageRating, reviewCount.
router.get('/:id/reviews', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        const reviews = await Review.find({ productId: req.params.id })
            .sort({ createdAt: -1 })
            .lean();

        const reviewCount = reviews.length;
        const averageRating = reviewCount > 0
            ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount) * 10) / 10
            : null;

        res.json({ reviews, averageRating, reviewCount });
    } catch (err) {
        console.error('GET reviews error:', err);
        res.status(500).json({ error: 'Could not fetch reviews' });
    }
});

// ── POST /api/products/:id/reviews ────────────────────────────────────────────
// Requires customer auth. Verifies purchase before allowing review.
router.post('/:id/reviews', requireCustomer, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        const productId = req.params.id;
        const customerId = req.customer.id;

        // Check: already reviewed?
        const existing = await Review.findOne({ productId, customerId });
        if (existing) {
            return res.status(409).json({ error: 'You have already reviewed this product' });
        }

        // Check: verified purchase
        const order = await Order.findOne({
            customerEmail: req.customer.email,
            'items.productId': new mongoose.Types.ObjectId(productId),
            status: { $in: ['paid', 'processing', 'shipped', 'delivered'] }
        });
        if (!order) {
            return res.status(403).json({ error: 'You must purchase this product before leaving a review' });
        }

        const { rating, title, body } = req.body;
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        const review = await Review.create({
            productId,
            customerId,
            customerName: `${req.customer.firstName || ''} ${req.customer.lastName || ''}`.trim() || 'Customer',
            rating: parseInt(rating),
            title: title ? String(title).slice(0, 120) : undefined,
            body:  body  ? String(body).slice(0, 2000)  : undefined
        });

        res.status(201).json({ review });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: 'You have already reviewed this product' });
        }
        console.error('POST review error:', err);
        res.status(500).json({ error: 'Could not save review' });
    }
});

// ── DELETE /api/products/:id/reviews/:reviewId ────────────────────────────────
// Customer can delete their own review; admin can delete any.
router.delete('/:id/reviews/:reviewId', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.reviewId)) {
            return res.status(400).json({ error: 'Invalid review ID' });
        }

        const review = await Review.findById(req.params.reviewId);
        if (!review) return res.status(404).json({ error: 'Review not found' });

        // Check admin token first
        const authHeader = req.headers.authorization || '';
        if (authHeader.startsWith('Bearer ')) {
            const jwt = require('jsonwebtoken');
            try {
                const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
                if (decoded.role === 'admin') {
                    await review.deleteOne();
                    return res.json({ message: 'Review deleted' });
                }
                if (decoded.role === 'customer' && String(decoded.id) === String(review.customerId)) {
                    await review.deleteOne();
                    return res.json({ message: 'Review deleted' });
                }
                return res.status(403).json({ error: 'Not authorized to delete this review' });
            } catch (jwtErr) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }
        }

        return res.status(401).json({ error: 'Authentication required' });
    } catch (err) {
        console.error('DELETE review error:', err);
        res.status(500).json({ error: 'Could not delete review' });
    }
});

module.exports = router;
