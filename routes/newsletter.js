const express    = require('express');
const router     = express.Router();
const Subscriber = require('../models/Subscriber');
const Campaign   = require('../models/Campaign');
const requireAuth = require('../middleware/auth');
const { getTransporter, isMailConfigured } = require('../utils/mailer');

// ─── Loaded lazily inside send-campaign to avoid circular-require at startup ──
function getCustomerModel() { return require('../models/Customer'); }
function getProductModel()  { return require('../models/Product');  }

// ─── Helper: build a 4-column product/wishlist HTML block ────────────────────
function buildProductSectionHtml(items, heading, frontendUrl, backendUrl) {
    if (!items || items.length === 0) return '';

    const cards = items.slice(0, 4).map(item => {
        // Works for both wishlist items (item.image) and Product docs (item.images[0])
        let imgSrc = item.image || (item.images && item.images[0]) || '';
        if (imgSrc && !imgSrc.startsWith('http')) {
            imgSrc = `${backendUrl}${imgSrc}`;
        }
        const imgTag = imgSrc
            ? `<img src="${imgSrc}" alt="" style="width:100%;height:130px;object-fit:contain;">`
            : '';
        const price = typeof item.price === 'number' ? `$${item.price.toFixed(2)}` : '';
        const link  = item.slug
            ? `${frontendUrl}/ProductDetail_v4.html?slug=${item.slug}`
            : `${frontendUrl}/shop.html`;

        return `<td style="width:25%;padding:8px;vertical-align:top;text-align:center;">
            ${imgTag}
            <p style="font-size:13px;color:#333;margin:8px 0 4px;line-height:1.3;">${item.name || ''}</p>
            <p style="font-size:14px;font-weight:700;color:#748a53;margin:0 0 10px;">${price}</p>
            <a href="${link}"
               style="background:#748a53;color:#fff;padding:6px 14px;border-radius:4px;
                      text-decoration:none;font-size:12px;">View</a>
        </td>`;
    }).join('');

    return `<div style="margin:28px 0;">
        <h3 style="font-family:Georgia,serif;color:#2d3a1e;font-size:16px;margin-bottom:16px;border-bottom:2px solid #f0f0f0;padding-bottom:10px;">
            ${heading}
        </h3>
        <table style="width:100%;border-collapse:collapse;"><tr>${cards}</tr></table>
    </div>`;
}

// ─── POST /api/newsletter/subscribe  — public ──────────────────────────────
router.post('/subscribe', async (req, res) => {
    try {
        const { email, source } = req.body;
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'A valid email address is required' });
        }

        const normalised = email.toLowerCase().trim();
        const subscriberSource = source === 'order' ? 'order' : 'newsletter-form';

        // Upsert: create or update existing subscriber
        const existing = await Subscriber.findOne({ email: normalised });

        if (existing) {
            if (!existing.isSubscribed) {
                // Re-subscribe — refresh consent
                existing.isSubscribed = true;
                existing.consentTimestamp = new Date();
                await existing.save();
                return res.json({ message: 'Welcome back! You have been re-subscribed.' });
            }
            // Already subscribed — silent success (no leak of subscription status)
            return res.json({ message: 'Thank you for subscribing!' });
        }

        // New subscriber
        const tags = subscriberSource === 'order' ? ['customer'] : ['newsletter'];
        await Subscriber.create({ email: normalised, source: subscriberSource, tags });
        res.status(201).json({ message: 'Thank you for subscribing!' });

    } catch (err) {
        if (err.code === 11000) {
            // Race condition duplicate — treat as success
            return res.json({ message: 'Thank you for subscribing!' });
        }
        console.error('Newsletter subscribe error:', err);
        res.status(500).json({ error: 'Could not process subscription. Please try again.' });
    }
});

// ─── GET /api/newsletter/unsubscribe/:token  — public one-click unsubscribe ─
router.get('/unsubscribe/:token', async (req, res) => {
    try {
        const subscriber = await Subscriber.findOne({ unsubscribeToken: req.params.token });
        if (!subscriber) {
            return res.status(404).json({ error: 'Unsubscribe link not found or already used.' });
        }

        subscriber.isSubscribed = false;
        await subscriber.save();

        res.json({ message: 'You have been successfully unsubscribed.' });
    } catch (err) {
        console.error('Unsubscribe error:', err);
        res.status(500).json({ error: 'Could not process unsubscribe. Please try again.' });
    }
});

// ─── GET /api/newsletter/subscribers  — protected, paginated ───────────────
router.get('/subscribers', requireAuth, async (req, res) => {
    try {
        const { page = 1, limit = 50, search, status } = req.query;
        const filter = {};
        if (status === 'active') filter.isSubscribed = true;
        if (status === 'unsubscribed') filter.isSubscribed = false;
        if (search) filter.email = { $regex: search, $options: 'i' };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [subscribers, total] = await Promise.all([
            Subscriber.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .select('-unsubscribeToken'),
            Subscriber.countDocuments(filter)
        ]);

        res.json({
            subscribers,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/newsletter/stats  — protected ────────────────────────────────
router.get('/stats', requireAuth, async (req, res) => {
    try {
        const [total, active, unsubscribed] = await Promise.all([
            Subscriber.countDocuments(),
            Subscriber.countDocuments({ isSubscribed: true }),
            Subscriber.countDocuments({ isSubscribed: false })
        ]);
        res.json({ total, active, unsubscribed });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/newsletter/campaigns  — protected ────────────────────────────
router.get('/campaigns', requireAuth, async (req, res) => {
    try {
        const campaigns = await Campaign.find().sort({ createdAt: -1 }).select('-htmlContent');
        res.json({ campaigns });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── DELETE /api/newsletter/campaigns/:id  — protected ─────────────────────
router.delete('/campaigns/:id', requireAuth, async (req, res) => {
    try {
        const campaign = await Campaign.findByIdAndDelete(req.params.id);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
        res.json({ message: 'Campaign deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/newsletter/send-campaign  — protected ───────────────────────
router.post('/send-campaign', requireAuth, async (req, res) => {
    try {
        const { name, subject, htmlContent, fromName, fromEmail } = req.body;
        if (!subject || !htmlContent) {
            return res.status(400).json({ error: 'Subject and content are required' });
        }
        if (!isMailConfigured()) {
            return res.status(503).json({ error: 'Email sending is not configured. Add SMTP settings to .env' });
        }

        // Fetch all active subscribers
        const subscribers = await Subscriber.find({ isSubscribed: true }).select('email unsubscribeToken');
        if (subscribers.length === 0) {
            return res.json({ message: 'No active subscribers to send to.', sent: 0 });
        }

        const transporter  = getTransporter();
        const senderName   = fromName  || process.env.SMTP_FROM_NAME || 'Hamadryad';
        const senderEmail  = fromEmail || process.env.SMTP_USER;
        const frontendUrl  = process.env.FRONTEND_URL || 'http://localhost:5500';
        const backendUrl   = process.env.BACKEND_URL  || 'http://localhost:3000';

        // Fetch featured products once as fallback for non-customer subscribers
        const Customer = getCustomerModel();
        const Product  = getProductModel();
        const featuredProducts = await Product
            .find({ featured: true, status: 'active' })
            .sort({ createdAt: -1 })
            .limit(4)
            .select('name price images slug');

        let sent = 0;
        let failed = 0;

        for (const subscriber of subscribers) {
            const unsubscribeUrl = `${frontendUrl}/unsubscribe.html?token=${subscriber.unsubscribeToken}`;

            // Look up customer wishlist for personalisation
            const cust      = await Customer.findOne({ email: subscriber.email }).select('wishlist firstName');
            const wishlist  = cust && cust.wishlist && cust.wishlist.length > 0 ? cust.wishlist : null;

            const productBlock = wishlist
                ? buildProductSectionHtml(wishlist, '🌿 Items from Your Wish List', frontendUrl, backendUrl)
                : buildProductSectionHtml(featuredProducts, '🌿 Our Featured Plants', frontendUrl, backendUrl);

            // Support {{PRODUCT_SECTION}} placeholder in campaign template, or append after content
            let personalContent = htmlContent.includes('{{PRODUCT_SECTION}}')
                ? htmlContent.replace('{{PRODUCT_SECTION}}', productBlock)
                : htmlContent + productBlock;

            const emailHtml = `${personalContent}
                <br>
                <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;">
                <p style="font-size:12px;color:#888;text-align:center;">
                    You are receiving this because you subscribed to Hamadryad updates.<br>
                    <a href="${unsubscribeUrl}" style="color:#888;">Unsubscribe</a>
                </p>`;

            try {
                await transporter.sendMail({
                    from: `"${senderName}" <${senderEmail}>`,
                    to:   subscriber.email,
                    subject,
                    html: emailHtml
                });
                sent++;
            } catch (mailErr) {
                console.error(`Failed to send to ${subscriber.email}:`, mailErr.message);
                failed++;
            }
        }

        // Persist campaign record
        await Campaign.create({
            name:           name || subject,
            subject,
            htmlContent,
            fromName:       senderName,
            fromEmail:      senderEmail,
            status:         'sent',
            sentAt:         new Date(),
            recipientCount: sent,
            failedCount:    failed
        });

        console.log(`📧 Campaign sent: ${sent} delivered, ${failed} failed`);
        res.json({ message: `Campaign sent to ${sent} subscriber${sent !== 1 ? 's' : ''}.`, sent, failed });

    } catch (err) {
        console.error('Send campaign error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─── PATCH /api/newsletter/subscribers/:id  — protected (manual unsub toggle)
router.patch('/subscribers/:id', requireAuth, async (req, res) => {
    try {
        const { isSubscribed } = req.body;
        if (typeof isSubscribed !== 'boolean') {
            return res.status(400).json({ error: 'isSubscribed must be a boolean' });
        }
        const update = { isSubscribed };
        if (isSubscribed) update.consentTimestamp = new Date();

        const subscriber = await Subscriber.findByIdAndUpdate(req.params.id, update, { new: true }).select('-unsubscribeToken');
        if (!subscriber) return res.status(404).json({ error: 'Subscriber not found' });
        res.json(subscriber);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
