const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const requireAuth = require('../middleware/auth');
const upload = require('../middleware/upload');

// GET /api/products/categories  — public, returns distinct active categories
// !! Must be defined BEFORE /:id to prevent 'categories' being treated as an ID
router.get('/categories', async (req, res) => {
    try {
        const cats = await Product.distinct('category', {
            status: 'active',
            category: { $exists: true, $ne: '' }
        });
        res.json(cats.filter(Boolean).sort());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/products  — public, supports filters + search + pagination
router.get('/', async (req, res) => {
    try {
        const {
            category, status, featured, search,
            minPrice, maxPrice,
            page = 1, limit = 20, sort = 'createdAt', order = 'desc'
        } = req.query;

        const filter = {};
        if (category) filter.category = category;
        if (status) filter.status = status;
        if (featured === 'true') filter.featured = true;
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = parseFloat(minPrice);
            if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
        }
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { sku: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } }
            ];
        }

        const sortObj = { [sort]: order === 'asc' ? 1 : -1 };
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [products, total] = await Promise.all([
            Product.find(filter).sort(sortObj).skip(skip).limit(parseInt(limit)),
            Product.countDocuments(filter)
        ]);

        res.json({ products, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/products/:id  — public
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/products  — protected, supports image upload
router.post('/', requireAuth, upload.array('images', 10), async (req, res) => {
    try {
        const data = { ...req.body };

        // Parse tags from comma-separated string or JSON array
        if (typeof data.tags === 'string') {
            data.tags = data.tags.split(',').map(t => t.trim()).filter(Boolean);
        }

        // Convert string booleans from FormData
        if (data.featured !== undefined) data.featured = data.featured === 'true';

        // Convert numeric strings
        ['price', 'comparePrice', 'costPrice', 'stock', 'lowStockThreshold', 'weight'].forEach(f => {
            if (data[f] !== undefined && data[f] !== '') data[f] = parseFloat(data[f]);
            else if (data[f] === '') delete data[f];
        });

        // Attach uploaded file paths
        const uploadedPaths = (req.files || []).map(f => `/uploads/${f.filename}`);

        // Also accept URL-based images passed as JSON array string
        let urlImages = [];
        if (data.imageUrls) {
            try { urlImages = JSON.parse(data.imageUrls); } catch (e) { /* ignore */ }
        }

        data.images = [...uploadedPaths, ...urlImages];

        const product = new Product(data);
        await product.save();
        res.status(201).json(product);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ error: 'A product with this SKU or slug already exists' });
        }
        res.status(400).json({ error: err.message });
    }
});

// PUT /api/products/:id  — protected
router.put('/:id', requireAuth, upload.array('images', 10), async (req, res) => {
    try {
        const data = { ...req.body };

        if (typeof data.tags === 'string') {
            data.tags = data.tags.split(',').map(t => t.trim()).filter(Boolean);
        }

        // Convert string booleans from FormData
        if (data.featured !== undefined) data.featured = data.featured === 'true';

        // Convert numeric strings
        ['price', 'comparePrice', 'costPrice', 'stock', 'lowStockThreshold', 'weight'].forEach(f => {
            if (data[f] !== undefined && data[f] !== '') data[f] = parseFloat(data[f]);
            else if (data[f] === '') delete data[f];
        });

        // New uploaded images
        const newUploaded = (req.files || []).map(f => `/uploads/${f.filename}`);

        // Existing images to keep (sent as JSON array from frontend)
        let existingImages = [];
        if (data.existingImages) {
            try { existingImages = JSON.parse(data.existingImages); } catch (e) { /* ignore */ }
        }

        // URL images
        let urlImages = [];
        if (data.imageUrls) {
            try { urlImages = JSON.parse(data.imageUrls); } catch (e) { /* ignore */ }
        }

        data.images = [...existingImages, ...newUploaded, ...urlImages];
        delete data.existingImages;
        delete data.imageUrls;

        const product = await Product.findByIdAndUpdate(req.params.id, data, {
            new: true,
            runValidators: true
        });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json(product);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/products/:id  — protected
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json({ message: 'Product deleted', id: req.params.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/products/:id/stock  — protected, quick stock update
router.patch('/:id/stock', requireAuth, async (req, res) => {
    try {
        const { stock } = req.body;
        if (stock === undefined) return res.status(400).json({ error: 'stock value required' });
        const product = await Product.findByIdAndUpdate(req.params.id, { stock }, { new: true });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json({ id: product._id, stock: product.stock });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
