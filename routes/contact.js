/**
 * routes/contact.js
 * POST /api/contact  — public
 * Sends the contact-us form submission to support@cultivatenaturally.shop
 * via Hostinger SMTP (configured in .env via SMTP_* vars).
 */
const express = require('express');
const router  = express.Router();
const { getTransporter, isMailConfigured } = require('../utils/mailer');

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

router.post('/', async (req, res) => {
    const { name, email, subject, message } = req.body;

    // Basic validation
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email and message are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (!isMailConfigured()) {
        console.warn('Contact form: SMTP not configured — check SMTP_HOST / SMTP_USER / SMTP_PASS env vars');
        return res.status(503).json({ error: 'Email service is temporarily unavailable. Please email us directly at support@cultivatenaturally.shop' });
    }

    try {
        const transporter = getTransporter();
        const subjectLine  = subject
            ? `[Contact Form] ${subject.trim()}`
            : `[Contact Form] Message from ${name.trim()}`;

        await transporter.sendMail({
            from:    `"Cultivate Naturally" <${process.env.SMTP_USER}>`,
            replyTo: `"${name.trim()}" <${email.trim()}>`,
            to:      'support@cultivatenaturally.shop',
            subject: subjectLine,
            html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                  <h2 style="color:#2d5a27;border-bottom:2px solid #e8f0e8;padding-bottom:12px">
                    New Contact Form Submission
                  </h2>
                  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
                    <tr>
                      <td style="padding:8px 12px;font-weight:bold;color:#241305;width:100px;vertical-align:top">Name:</td>
                      <td style="padding:8px 12px">${escapeHtml(name)}</td>
                    </tr>
                    <tr style="background:#f9faf7">
                      <td style="padding:8px 12px;font-weight:bold;color:#241305;vertical-align:top">Email:</td>
                      <td style="padding:8px 12px">
                        <a href="mailto:${escapeHtml(email)}" style="color:#748a53">${escapeHtml(email)}</a>
                      </td>
                    </tr>
                    ${subject ? `
                    <tr>
                      <td style="padding:8px 12px;font-weight:bold;color:#241305;vertical-align:top">Subject:</td>
                      <td style="padding:8px 12px">${escapeHtml(subject)}</td>
                    </tr>` : ''}
                  </table>
                  <p style="font-weight:bold;color:#241305;margin-bottom:8px">Message:</p>
                  <div style="background:#f9faf7;border:1px solid #e8f0e8;border-radius:6px;
                              padding:16px;white-space:pre-wrap;color:#333;line-height:1.6">
                    ${escapeHtml(message)}
                  </div>
                  <p style="color:#aaa;font-size:11px;margin-top:24px;border-top:1px solid #f0f0f0;padding-top:12px">
                    Sent via the contact form at cultivatenaturally.shop<br>
                    Hit Reply to respond directly to ${escapeHtml(name)}.
                  </p>
                </div>
            `
        });

        res.json({ ok: true, message: "Message sent! We'll get back to you within 1–2 business days." });
    } catch (err) {
        console.error('Contact form mailer error:', err.message);
        res.status(500).json({ error: 'Failed to send your message. Please try again or email us directly at support@cultivatenaturally.shop' });
    }
});

module.exports = router;
