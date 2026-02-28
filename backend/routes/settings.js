const express  = require('express');
const router   = express.Router();
const Settings = require('../models/Settings');
const requireAuth = require('../middleware/auth');

// ── GET /api/settings — fetch the singleton settings doc ──────────────────────
router.get('/', requireAuth, async (req, res) => {
    try {
        let settings = await Settings.findOne({ key: 'global' });
        if (!settings) {
            settings = await Settings.create({ key: 'global' });
        }
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── PATCH /api/settings — update settings (partial update) ────────────────────
router.patch('/', requireAuth, async (req, res) => {
    try {
        const allowed = [
            'storeName', 'tagline', 'contactEmail', 'contactPhone', 'address',
            'socialInstagram', 'socialFacebook', 'socialTwitter', 'socialYoutube',
            'announcementText', 'announcementEnabled',
            'smtpHost', 'smtpPort', 'smtpUser', 'smtpPass', 'smtpFromName', 'smtpFromEmail',
            'frontendUrl', 'backendUrl',
            'maintenanceMode'
        ];

        const updates = {};
        allowed.forEach(field => {
            if (req.body[field] !== undefined) updates[field] = req.body[field];
        });

        const settings = await Settings.findOneAndUpdate(
            { key: 'global' },
            { $set: updates },
            { new: true, upsert: true }
        );
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/settings/public — non-authenticated public fields ─────────────────
router.get('/public', async (req, res) => {
    try {
        let settings = await Settings.findOne({ key: 'global' }).select(
            'storeName tagline contactEmail contactPhone address ' +
            'socialInstagram socialFacebook socialTwitter socialYoutube ' +
            'announcementText announcementEnabled'
        );
        res.json(settings || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
