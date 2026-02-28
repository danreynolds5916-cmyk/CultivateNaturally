const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    sku: { type: String, unique: true, trim: true },
    slug: { type: String, unique: true, trim: true, lowercase: true },
    category: {
        type: String,
        enum: ['lighting', 'hydroponics', 'nutrients', 'grow-tents', 'environmental', 'other'],
        default: 'other'
    },
    subcategory: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    comparePrice: { type: Number, min: 0 },   // original / crossed-out price
    costPrice: { type: Number, min: 0 },       // your cost (not shown publicly)
    description: { type: String },
    shortDescription: { type: String },
    images: [{ type: String }],               // array of paths or URLs
    status: {
        type: String,
        enum: ['active', 'inactive', 'out-of-stock', 'discontinued'],
        default: 'active'
    },
    featured: { type: Boolean, default: false },

    // ─── Stock Management ─────────────────────────────────────────────────
    stockMode: {
        type: String,
        enum: ['manual', 'supplier'],
        default: 'manual'
    },
    stock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 10 },
    supplierUrl: { type: String },            // link to supplier product page
    supplierNotes: { type: String },          // internal notes about supplier

    // ─── Shipping ─────────────────────────────────────────────────────────
    weight: { type: Number },                 // kg
    dimensions: { type: String },             // e.g. "12x8x4"

    // ─── SEO ──────────────────────────────────────────────────────────────
    tags: [{ type: String }],
    metaTitle: { type: String },
    metaDescription: { type: String }
}, { timestamps: true });

// Auto-generate slug from name if not provided
productSchema.pre('save', function (next) {
    if (!this.slug && this.name) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
    if (!this.sku && this.name) {
        const prefix = this.name.split(' ').map(w => w[0]?.toUpperCase() || '').join('');
        this.sku = `${prefix}-${Date.now().toString().slice(-4)}`;
    }
    next();
});

module.exports = mongoose.model('Product', productSchema);
