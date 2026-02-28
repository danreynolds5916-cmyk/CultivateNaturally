const mongoose = require('mongoose');

// Daily analytics snapshot — one document per day
const analyticsSchema = new mongoose.Schema({
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD
    visitors: { type: Number, default: 0 },
    pageViews: { type: Number, default: 0 },
    uniqueSessions: { type: [String], default: [] },       // array of session IDs for unique visitor counting
    bounces: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    ordersCount: { type: Number, default: 0 },
    // Computed fields (updated at end of day or on demand)
    bounceRate: { type: Number, default: 0 },             // %
    conversionRate: { type: Number, default: 0 },         // %
    avgOrderValue: { type: Number, default: 0 },
    topProducts: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        productName: String,
        revenue: Number,
        units: Number
    }]
}, { timestamps: true });

// PageView event — raw tracking data
const pageViewSchema = new mongoose.Schema({
    sessionId: { type: String },
    page: { type: String },
    referrer: { type: String },
    userAgent: { type: String },
    ip: { type: String },
    date: { type: String }, // YYYY-MM-DD for quick grouping
    timestamp: { type: Date, default: Date.now }
});

module.exports = {
    Analytics: mongoose.model('Analytics', analyticsSchema),
    PageView: mongoose.model('PageView', pageViewSchema)
};
