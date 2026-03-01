const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const BlogPost        = require('../models/BlogPost');
const requireAuth     = require('../middleware/auth');         // admin JWT
const requireCustomer = require('../middleware/customerAuth'); // customer JWT
const { upload }      = require('../middleware/cloudinaryUpload');
const { checkContent } = require('../utils/automod');

// ─── GET /api/blog  — public (only published) / admin (all with ?admin=true + auth) ──
router.get('/', async (req, res) => {
    try {
        const { status, category, search, page = 1, limit = 10, admin } = req.query;

        const filter = {};
        if (admin !== 'true') {
            filter.status = 'published';
        } else if (status) {
            filter.status = status;
        }

        if (category) filter.category = category;
        if (search) {
            filter.$or = [
                { title:   { $regex: search, $options: 'i' } },
                { excerpt: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } },
                { tags:    { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [posts, total] = await Promise.all([
            BlogPost.find(filter)
                .sort({ publishDate: -1, createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .select(admin !== 'true' ? '-content' : undefined),
            BlogPost.countDocuments(filter)
        ]);

        res.json({ posts, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/blog/scheduled/:year/:month  — admin calendar view ──────────────
router.get('/scheduled/:year/:month', requireAuth, async (req, res) => {
    try {
        const { year, month } = req.params;
        const start = new Date(parseInt(year), parseInt(month) - 1, 1);
        const end   = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

        const posts = await BlogPost.find({
            status: { $in: ['scheduled', 'published'] },
            publishDate: { $gte: start, $lte: end }
        }).select('title status publishDate slug category');

        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/blog/:id  — public; accepts ObjectId or slug ───────────────────
router.get('/:id', async (req, res) => {
    try {
        let post = null;
        try { post = await BlogPost.findById(req.params.id); } catch (e) { /* not a valid ObjectId */ }
        if (!post) post = await BlogPost.findOne({ slug: req.params.id });
        if (!post) return res.status(404).json({ error: 'Post not found' });

        if (post.status === 'published' && req.query.admin !== 'true') {
            post.views = (post.views || 0) + 1;
            await post.save();
        }

        res.json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/blog  — admin only ────────────────────────────────────────────
router.post('/', requireAuth, upload.single('featuredImage'), async (req, res) => {
    try {
        const data = { ...req.body };

        if (typeof data.tags === 'string') {
            data.tags = data.tags.split(',').map(t => t.trim()).filter(Boolean);
        }

        // Cloudinary: req.file.path is the full Cloudinary URL
        if (req.file) {
            data.featuredImage = req.file.path;
        }

        if (data.publishDate) {
            data.publishDate = new Date(data.publishDate);
        }

        const post = new BlogPost(data);
        await post.save();
        res.status(201).json(post);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ error: 'A post with this slug already exists' });
        }
        res.status(400).json({ error: err.message });
    }
});

// ─── PUT /api/blog/:id  — admin only ─────────────────────────────────────────
router.put('/:id', requireAuth, upload.single('featuredImage'), async (req, res) => {
    try {
        const data = { ...req.body };

        if (typeof data.tags === 'string') {
            data.tags = data.tags.split(',').map(t => t.trim()).filter(Boolean);
        }

        if (req.file) {
            // New image uploaded to Cloudinary
            data.featuredImage = req.file.path;
        } else if (data.existingFeaturedImage) {
            // Preserve the existing image (Cloudinary URL or old /uploads/ path)
            data.featuredImage = data.existingFeaturedImage;
        }
        delete data.existingFeaturedImage;

        if (data.publishDate) {
            data.publishDate = new Date(data.publishDate);
        } else if (data.publishDate === '') {
            data.publishDate = null;
        }

        const post = await BlogPost.findByIdAndUpdate(req.params.id, data, {
            new: true,
            runValidators: true
        });
        if (!post) return res.status(404).json({ error: 'Post not found' });
        res.json(post);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ─── DELETE /api/blog/:id  — admin only ──────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const post = await BlogPost.findByIdAndDelete(req.params.id);
        if (!post) return res.status(404).json({ error: 'Post not found' });
        res.json({ message: 'Post deleted', id: req.params.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/blog/:id/comments  — public ────────────────────────────────────
router.get('/:id/comments', async (req, res) => {
    try {
        const post = await BlogPost.findById(req.params.id).select('commentList');
        if (!post) return res.status(404).json({ error: 'Post not found' });
        res.json(post.commentList || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PATCH /api/blog/:id/reset-views  — admin only ───────────────────────────
router.patch('/:id/reset-views', requireAuth, async (req, res) => {
    try {
        const post = await BlogPost.findByIdAndUpdate(req.params.id, { $set: { views: 0 } }, { new: true });
        if (!post) return res.status(404).json({ error: 'Post not found' });
        res.json({ ok: true, views: post.views });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/blog/:id/comments  — signed-in customers only ─────────────────
router.post('/:id/comments', requireCustomer, async (req, res) => {
    try {
        const { body } = req.body;
        if (!body || !body.trim()) {
            return res.status(400).json({ error: 'Comment body is required' });
        }

        const customer = req.customer; // { id, email, firstName, lastName, role }
        const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim()
                     || customer.email;

        const mod = checkContent(`${name} ${body}`);
        if (mod.blocked) return res.status(422).json({ error: mod.reason });

        const post = await BlogPost.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Post not found' });
        if (post.status !== 'published') return res.status(403).json({ error: 'Post not available' });

        const comment = {
            name,
            email:      customer.email,
            customerId: customer.id,
            body:       body.trim(),
            createdAt:  new Date()
        };
        post.commentList = post.commentList || [];
        post.commentList.push(comment);
        post.comments = post.commentList.length;
        await post.save();

        const saved = post.commentList[post.commentList.length - 1];
        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PUT /api/blog/:id/comments/:commentId  — edit own comment (customer) ────
router.put('/:id/comments/:commentId', requireCustomer, async (req, res) => {
    try {
        const { body } = req.body;
        if (!body || !body.trim()) {
            return res.status(400).json({ error: 'Comment body is required' });
        }

        const mod = checkContent(body);
        if (mod.blocked) return res.status(422).json({ error: mod.reason });

        const post = await BlogPost.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        const comment = (post.commentList || []).find(
            c => c._id.toString() === req.params.commentId
        );
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        // Only the comment author may edit
        if (!comment.customerId || comment.customerId.toString() !== req.customer.id) {
            return res.status(403).json({ error: 'You can only edit your own comments' });
        }

        comment.body     = body.trim();
        comment.editedAt = new Date();
        await post.save();

        res.json(comment);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── DELETE /api/blog/:id/comments/:commentId  — admin OR own comment ─────────
router.delete('/:id/comments/:commentId', async (req, res) => {
    // Accept admin token OR customer token (can only delete own)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    let isAdmin    = false;
    let customerId = null;
    try {
        const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
        if (decoded.role === 'admin') {
            isAdmin = true;
        } else if (decoded.role === 'customer') {
            customerId = decoded.id;
        } else {
            return res.status(403).json({ error: 'Not authorized' });
        }
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    try {
        const post = await BlogPost.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        const comment = (post.commentList || []).find(
            c => c._id.toString() === req.params.commentId
        );
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        // Customers may only delete their own comments
        if (!isAdmin) {
            if (!comment.customerId || comment.customerId.toString() !== customerId) {
                return res.status(403).json({ error: 'You can only delete your own comments' });
            }
        }

        post.commentList = post.commentList.filter(
            c => c._id.toString() !== req.params.commentId
        );
        post.comments = post.commentList.length;
        await post.save();

        res.json({ ok: true, remaining: post.comments });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
