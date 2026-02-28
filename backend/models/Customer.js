const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');

// ─── Sub-schemas (no _id — match localStorage shapes exactly) ─────────────────

const wishlistItemSchema = new mongoose.Schema({
    id:           { type: String, required: true },
    name:         { type: String, required: true },
    price:        { type: Number, required: true },
    comparePrice: { type: Number, default: 0 },
    image:        { type: String, default: '' },
    sku:          { type: String, default: '' }
}, { _id: false });

const cartItemSchema = new mongoose.Schema({
    id:       { type: String, required: true },
    name:     { type: String, required: true },
    price:    { type: Number, required: true },
    image:    { type: String, default: '' },
    quantity: { type: Number, default: 1, min: 1 },
    sku:      { type: String, default: '' }
}, { _id: false });

// ─── Main schema ──────────────────────────────────────────────────────────────

const customerSchema = new mongoose.Schema({
    email: {
        type:      String,
        required:  true,
        unique:    true,
        lowercase: true,
        trim:      true
    },
    password: {
        type:     String,
        required: true
    },
    firstName: { type: String, trim: true, default: '' },
    lastName:  { type: String, trim: true, default: '' },

    // ── Wishlist (synced from localStorage hmd_wishlist) ─────────────────────
    wishlist: [wishlistItemSchema],

    // ── Abandoned cart tracking ───────────────────────────────────────────────
    abandonedCart: {
        items:        [cartItemSchema],
        snapshotAt:   { type: Date, default: null },   // first non-empty cart detection
        lastActivity: { type: Date, default: null },   // latest cart sync
        emailsSent: {
            reminder1: { type: Boolean, default: false },  // ~1 hour
            reminder2: { type: Boolean, default: false },  // ~24 hours
            reminder3: { type: Boolean, default: false }   // ~72 hours
        }
    },

    // ── Password reset ────────────────────────────────────────────────────────
    passwordResetToken:   { type: String, select: false },   // SHA-256 hash stored
    passwordResetExpires: { type: Date,   select: false },

    isVerified: { type: Boolean, default: true }  // email verification skipped for now

}, { timestamps: true });

// ─── Pre-save: hash password only when changed ────────────────────────────────
customerSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// ─── Instance: compare plaintext password ─────────────────────────────────────
customerSchema.methods.comparePassword = async function (candidate) {
    return bcrypt.compare(candidate, this.password);
};

/**
 * Generate a password reset token.
 * - Raw 32-byte hex token is returned (goes in email link — never stored)
 * - SHA-256 hash of the raw token is stored in passwordResetToken
 * - Token expires in 1 hour
 */
customerSchema.methods.createPasswordResetToken = function () {
    const rawToken = crypto.randomBytes(32).toString('hex');
    this.passwordResetToken   = crypto.createHash('sha256').update(rawToken).digest('hex');
    this.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    return rawToken;
};

module.exports = mongoose.model('Customer', customerSchema);
