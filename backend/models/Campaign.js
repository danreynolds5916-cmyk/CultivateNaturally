const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
    name:           { type: String, required: true },
    subject:        { type: String, required: true },
    htmlContent:    { type: String, default: '' },
    fromName:       { type: String, default: '' },
    fromEmail:      { type: String, default: '' },
    status:         { type: String, enum: ['draft', 'sent'], default: 'draft' },
    sentAt:         { type: Date },
    recipientCount: { type: Number, default: 0 },
    failedCount:    { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Campaign', campaignSchema);
