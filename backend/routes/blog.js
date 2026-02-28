const express = require('express');
const router = express.Router();
const BlogPost = require('../models/BlogPost');
const requireAuth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { checkContent } = require('../utils/automod');

// GET /api/blog  — public (only published) / admin (all statuses with ?admin=true + auth)
router.get('/', async (req, res) => {
    try {
        const { status, category, search, page = 1, limit = 10, admin } = req.query;

        const filter = {};
        // Public view: only published posts
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
                .select(admin !== 'true' ? '-content' : undefined), // exclude heavy content from list
            BlogPost.countDocuments(filter)
        ]);

        res.json({ posts, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/blog/scheduled/:year/:month  — admin calendar view
router.get('/scheduled/:year/:month', requireAuth, async (req, res) => {
    try {
        const { year, month } = req.params;
        const start = new Date(parseInt(year), parseInt(month) - 1, 1);
        const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

        const posts = await BlogPost.find({
            status: { $in: ['scheduled', 'published'] },
            publishDate: { $gte: start, $lte: end }
        }).select('title status publishDate slug category');

        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/blog/:id  — accepts MongoDB ObjectId OR slug; draft posts accessible by direct link
router.get('/:id', async (req, res) => {
    try {
        // Try ObjectId lookup first; if it throws (invalid ObjectId) or returns null, fall back to slug
        let post = null;
        try { post = await BlogPost.findById(req.params.id); } catch (e) { /* not a valid ObjectId — try slug */ }
        if (!post) post = await BlogPost.findOne({ slug: req.params.id });
        if (!post) return res.status(404).json({ error: 'Post not found' });

        // Increment views for published posts — skip when ?admin=true (CMS preview)
        if (post.status === 'published' && req.query.admin !== 'true') {
            post.views = (post.views || 0) + 1;
            await post.save();
        }

        res.json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/blog  — protected
router.post('/', requireAuth, upload.single('featuredImage'), async (req, res) => {
    try {
        const data = { ...req.body };

        if (typeof data.tags === 'string') {
            data.tags = data.tags.split(',').map(t => t.trim()).filter(Boolean);
        }

        if (req.file) {
            data.featuredImage = `/uploads/${req.file.filename}`;
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

// PUT /api/blog/:id  — protected
router.put('/:id', requireAuth, upload.single('featuredImage'), async (req, res) => {
    try {
        const data = { ...req.body };

        if (typeof data.tags === 'string') {
            data.tags = data.tags.split(',').map(t => t.trim()).filter(Boolean);
        }

        if (req.file) {
            data.featuredImage = `/uploads/${req.file.filename}`;
        }

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

// DELETE /api/blog/:id  — protected
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const post = await BlogPost.findByIdAndDelete(req.params.id);
        if (!post) return res.status(404).json({ error: 'Post not found' });
        res.json({ message: 'Post deleted', id: req.params.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/blog/:id/comments  — public
router.get('/:id/comments', async (req, res) => {
    try {
        const post = await BlogPost.findById(req.params.id).select('commentList');
        if (!post) return res.status(404).json({ error: 'Post not found' });
        res.json(post.commentList || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/blog/:id/reset-views  — admin only
router.patch('/:id/reset-views', requireAuth, async (req, res) => {
    try {
        const post = await BlogPost.findByIdAndUpdate(req.params.id, { $set: { views: 0 } }, { new: true });
        if (!post) return res.status(404).json({ error: 'Post not found' });
        res.json({ ok: true, views: post.views });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/blog/:id/comments  — public (anyone can comment)
router.post('/:id/comments', async (req, res) => {
    try {
        const { name, email, body } = req.body;
        if (!name || !body) return res.status(400).json({ error: 'Name and comment are required' });

        // Auto-moderation: check name + body together
        const combinedText = `${name} ${body}`;
        const mod = checkContent(combinedText);
        if (mod.blocked) {
            return res.status(422).json({ error: mod.reason });
        }

        const post = await BlogPost.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Post not found' });
        if (post.status !== 'published') return res.status(403).json({ error: 'Post not available' });

        const comment = { name: name.trim(), email: (email || '').trim(), body: body.trim(), createdAt: new Date() };
        post.commentList = post.commentList || [];
        post.commentList.push(comment);
        post.comments = post.commentList.length;
        await post.save();

        // Return the saved comment (with its _id from Mongoose)
        const saved = post.commentList[post.commentList.length - 1];
        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/blog/:id/comments/:commentId  — admin only
router.delete('/:id/comments/:commentId', requireAuth, async (req, res) => {
    try {
        const post = await BlogPost.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        const before = (post.commentList || []).length;
        post.commentList = (post.commentList || []).filter(
            c => c._id.toString() !== req.params.commentId
        );
        if (post.commentList.length === before) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        post.comments = post.commentList.length;
        await post.save();
        res.json({ ok: true, remaining: post.comments });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
