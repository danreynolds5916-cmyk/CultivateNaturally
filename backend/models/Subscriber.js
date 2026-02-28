const mongoose = require('mongoose');
const crypto = require('crypto');

const subscriberSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    source: {
        type: String,
        enum: ['newsletter-form', 'order'],
        default: 'newsletter-form'
    },
    isSubscribed: {
        type: Boolean,
        default: true
    },
    unsubscribeToken: {
        type: String,
        unique: true,
        sparse: true
    },
    consentTimestamp: {
        type: Date,
        default: Date.now
    },
    tags: [{ type: String }]
}, { timestamps: true });

// Auto-generate unsubscribe token before saving
subscriberSchema.pre('save', function (next) {
    if (!this.unsubscribeToken) {
        this.unsubscribeToken = crypto.randomBytes(32).toString('hex');
    }
    next();
});

module.exports = mongoose.model('Subscriber', subscriberSchema);
