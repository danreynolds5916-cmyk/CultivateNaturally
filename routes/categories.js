const express = require('express');
const router  = express.Router();
const Product = require('../models/Product');

// GET /api/categories
// Returns unique categories with their active product counts, sorted by count desc.
router.get('/', async (req, res) => {
    try {
        const results = await Product.aggregate([
            { $match: { status: 'active', category: { $exists: true, $ne: '' } } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const categories = results.map(r => ({ name: r._id, count: r.count }));
        res.json(categories);
    } catch (err) {
        console.error('Categories error:', err);
        res.status(500).json({ error: 'Failed to load categories' });
    }
});

module.exports = router;
