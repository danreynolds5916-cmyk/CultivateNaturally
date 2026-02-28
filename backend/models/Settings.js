const mongoose = require('mongoose');

// Singleton settings document — always find/update the one record with key: 'global'
const settingsSchema = new mongoose.Schema({
    key: { type: String, default: 'global', unique: true },

    // Store identity
    storeName:    { type: String, default: 'Cultivate Naturally' },
    tagline:      { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    address:      { type: String, default: '' },

    // Social media
    socialInstagram: { type: String, default: '' },
    socialFacebook:  { type: String, default: '' },
    socialTwitter:   { type: String, default: '' },
    socialYoutube:   { type: String, default: '' },

    // Announcement bar
    announcementText:    { type: String, default: '' },
    announcementEnabled: { type: Boolean, default: false },

    // SMTP / email config (stored in DB so admin can update without touching .env)
    smtpHost:     { type: String, default: '' },
    smtpPort:     { type: Number, default: 587 },
    smtpUser:     { type: String, default: '' },
    smtpPass:     { type: String, default: '' },   // stored as-is; consider encrypting in production
    smtpFromName: { type: String, default: '' },
    smtpFromEmail:{ type: String, default: '' },

    // URLs
    frontendUrl:  { type: String, default: '' },
    backendUrl:   { type: String, default: '' },

    // Maintenance mode
    maintenanceMode: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
