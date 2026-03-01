const mongoose = require('mongoose');

const blogPostSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, trim: true, lowercase: true },
    excerpt: { type: String },
    content: { type: String },               // HTML content from rich editor
    status: {
        type: String,
        enum: ['draft', 'published', 'scheduled', 'archived'],
        default: 'draft'
    },
    category: { type: String, default: 'general' },
    tags: [{ type: String }],
    featuredImage: { type: String },          // path or URL
    author: { type: String, default: 'Admin' },
    publishDate: { type: Date },             // for scheduling
    metaTitle: { type: String },
    metaDescription: { type: String },
    views: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    commentList: [{
        name:       { type: String, required: true },
        email:      { type: String, default: '' },
        customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
        body:       { type: String, required: true },
        editedAt:   { type: Date, default: null },
        createdAt:  { type: Date, default: Date.now }
    }]
}, { timestamps: true });

// Auto-generate slug from title
blogPostSchema.pre('save', function (next) {
    if (!this.slug && this.title) {
        this.slug = this.title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
    next();
});

module.exports = mongoose.model('BlogPost', blogPostSchema);
