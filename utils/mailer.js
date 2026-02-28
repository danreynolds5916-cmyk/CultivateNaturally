/**
 * utils/mailer.js
 * Shared Nodemailer transporter for all email sending in the backend.
 * Import getTransporter() wherever you need to send email.
 */
const nodemailer = require('nodemailer');

/**
 * Returns a configured Nodemailer transporter.
 * Lazy-initialised so missing SMTP env vars don't crash server startup.
 */
function getTransporter() {
    return nodemailer.createTransport({
        host:   process.env.SMTP_HOST,
        port:   parseInt(process.env.SMTP_PORT) || 587,
        secure: parseInt(process.env.SMTP_PORT) === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
}

/**
 * Quick check: are SMTP env vars configured?
 */
function isMailConfigured() {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
              && !process.env.SMTP_HOST.includes('yourprovider'));
}

module.exports = { getTransporter, isMailConfigured };
