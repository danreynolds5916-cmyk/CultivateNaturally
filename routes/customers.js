const express        = require('express');
const router         = express.Router();
const crypto         = require('crypto');
const jwt            = require('jsonwebtoken');
const Customer       = require('../models/Customer');
const Subscriber     = require('../models/Subscriber');
const Order          = require('../models/Order');
const requireCustomer = require('../middleware/customerAuth');
const { getTransporter, isMailConfigured } = require('../utils/mailer');

// ─── Helper: sign a customer JWT ──────────────────────────────────────────────
function signToken(customer) {
    return jwt.sign(
        {
            id:        customer._id,
            email:     customer.email,
            firstName: customer.firstName,
            lastName:  customer.lastName,
            role:      'customer'
        },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
}

// ─── POST /api/customers/register  — public ───────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const existing = await Customer.findOne({ email: email.toLowerCase().trim() });
        if (existing) {
            return res.status(409).json({ error: 'An account with that email already exists' });
        }

        const customer = await Customer.create({
            email: email.toLowerCase().trim(),
            password,
            firstName: (firstName || '').trim(),
            lastName:  (lastName  || '').trim()
        });

        // Auto-subscribe to newsletter (soft opt-in)
        const sub = await Subscriber.findOne({ email: customer.email });
        if (!sub) {
            await Subscriber.create({
                email:  customer.email,
                source: 'newsletter-form',
                tags:   ['customer']
            });
        } else if (!sub.tags.includes('customer')) {
            sub.tags.push('customer');
            await sub.save();
        }

        const token = signToken(customer);
        res.status(201).json({
            token,
            customer: { id: customer._id, email: customer.email, firstName: customer.firstName, lastName: customer.lastName }
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: 'An account with that email already exists' });
        }
        console.error('Register error:', err);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

// ─── POST /api/customers/login  — public ──────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const customer = await Customer.findOne({ email: email.toLowerCase().trim() });
        if (!customer) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const match = await customer.comparePassword(password);
        if (!match) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = signToken(customer);
        res.json({
            token,
            customer: { id: customer._id, email: customer.email, firstName: customer.firstName, lastName: customer.lastName }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

// ─── GET /api/customers/me  — protected ──────────────────────────────────────
router.get('/me', requireCustomer, async (req, res) => {
    try {
        const customer = await Customer.findById(req.customer.id).select('email firstName lastName createdAt');
        if (!customer) return res.status(404).json({ error: 'Account not found' });
        res.json({ id: customer._id, email: customer.email, firstName: customer.firstName, lastName: customer.lastName, createdAt: customer.createdAt });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/customers/forgot-password  — public ───────────────────────────
router.post('/forgot-password', async (req, res) => {
    // Always return 200 to prevent email enumeration
    const successMsg = { message: 'If that email is registered, a password reset link has been sent.' };

    try {
        const { email } = req.body;
        if (!email) return res.json(successMsg);

        const customer = await Customer.findOne({ email: email.toLowerCase().trim() });
        if (!customer) return res.json(successMsg);

        if (!isMailConfigured()) {
            console.warn('Password reset requested but SMTP is not configured');
            return res.json(successMsg);
        }

        const rawToken    = customer.createPasswordResetToken();
        await customer.save({ validateBeforeSave: false });

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5500';
        const resetUrl    = `${frontendUrl}/Account.html?tab=reset&token=${rawToken}`;

        const html = `
            <p>Hi ${customer.firstName || 'there'},</p>
            <p>We received a request to reset your Hamadryad account password.</p>
            <p style="margin:24px 0;">
                <a href="${resetUrl}"
                   style="background:#748a53;color:#fff;padding:12px 28px;border-radius:6px;
                          text-decoration:none;font-weight:600;">
                    Reset My Password
                </a>
            </p>
            <p style="font-size:13px;color:#888;">This link expires in 1 hour. If you didn't request a reset, you can safely ignore this email.</p>
            <p style="font-size:13px;color:#aaa;">Or copy this URL: ${resetUrl}</p>`;

        const transporter = getTransporter();
        await transporter.sendMail({
            from:    `"${process.env.SMTP_FROM_NAME || 'Hamadryad'}" <${process.env.SMTP_USER}>`,
            to:      customer.email,
            subject: 'Reset your Hamadryad password',
            html
        });
    } catch (err) {
        console.error('Forgot password error:', err.message);
        // Still return 200 — don't expose internals
    }

    res.json(successMsg);
});

// ─── POST /api/customers/reset-password  — public ────────────────────────────
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const customer = await Customer.findOne({
            passwordResetToken:   hashedToken,
            passwordResetExpires: { $gt: Date.now() }
        }).select('+passwordResetToken +passwordResetExpires');

        if (!customer) {
            return res.status(400).json({ error: 'Reset link is invalid or has expired. Please request a new one.' });
        }

        customer.password             = password; // pre-save hook hashes it
        customer.passwordResetToken   = undefined;
        customer.passwordResetExpires = undefined;
        await customer.save();

        res.json({ message: 'Password updated successfully. You can now sign in.' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Could not reset password. Please try again.' });
    }
});

// ─── GET /api/customers/me/orders  — protected ───────────────────────────────
router.get('/me/orders', requireCustomer, async (req, res) => {
    try {
        const orders = await Order.find(
            { customerEmail: req.customer.email },
            'items total currency status createdAt shippingAddress trackingNumber trackingCarrier customerName stripeSessionId'
        ).sort({ createdAt: -1 }).limit(50);

        const publicOrders = orders.map(o => ({
            orderId:         o._id,
            stripeSessionId: o.stripeSessionId,
            date:            o.createdAt,
            status:          o.status,
            total:           o.total,
            currency:        o.currency,
            items:           o.items,
            shippingAddress: o.shippingAddress,
            trackingNumber:  o.trackingNumber || null,
            trackingCarrier: o.trackingCarrier || null,
            customerName:    o.customerName
        }));

        res.json({ orders: publicOrders, count: publicOrders.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/customers/me/wishlist  — protected ─────────────────────────────
router.get('/me/wishlist', requireCustomer, async (req, res) => {
    try {
        const customer = await Customer.findById(req.customer.id).select('wishlist');
        if (!customer) return res.status(404).json({ error: 'Account not found' });
        res.json({ wishlist: customer.wishlist });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PUT /api/customers/me/wishlist  — protected (full replace) ──────────────
router.put('/me/wishlist', requireCustomer, async (req, res) => {
    try {
        const { wishlist } = req.body;
        if (!Array.isArray(wishlist)) {
            return res.status(400).json({ error: 'wishlist must be an array' });
        }

        const customer = await Customer.findByIdAndUpdate(
            req.customer.id,
            { $set: { wishlist } },
            { new: true, select: 'wishlist' }
        );
        if (!customer) return res.status(404).json({ error: 'Account not found' });
        res.json({ wishlist: customer.wishlist });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PATCH /api/customers/me/cart  — protected (abandoned cart tracking) ──────
router.patch('/me/cart', requireCustomer, async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items)) {
            return res.status(400).json({ error: 'items must be an array' });
        }

        const now = new Date();
        let update;

        if (items.length === 0) {
            // Cart cleared (checkout or manual) — reset everything
            update = {
                $set: {
                    'abandonedCart.items':              [],
                    'abandonedCart.snapshotAt':         null,
                    'abandonedCart.lastActivity':       null,
                    'abandonedCart.emailsSent.reminder1': false,
                    'abandonedCart.emailsSent.reminder2': false,
                    'abandonedCart.emailsSent.reminder3': false
                }
            };
        } else {
            // Has items — update snapshot
            const customer = await Customer.findById(req.customer.id).select('abandonedCart');
            const hasExistingSnapshot = customer && customer.abandonedCart && customer.abandonedCart.snapshotAt;

            update = {
                $set: {
                    'abandonedCart.items':        items,
                    'abandonedCart.lastActivity': now,
                    // Only set snapshotAt on the first time we see a non-empty cart
                    ...(hasExistingSnapshot ? {} : { 'abandonedCart.snapshotAt': now })
                }
            };
        }

        await Customer.findByIdAndUpdate(req.customer.id, update);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
