/**
 * jobs/abandonedCart.js
 * Checks for logged-in customers with abandoned carts and sends
 * a gentle 3-email nurture sequence.
 *
 * Called every 15 minutes via setInterval in server.js.
 */
const { getTransporter, isMailConfigured } = require('../utils/mailer');

const ONE_HOUR   = 60 * 60 * 1000;
const ONE_DAY    = 24 * ONE_HOUR;
const THREE_DAYS = 3  * ONE_DAY;

// ─── Main check function ──────────────────────────────────────────────────────
async function checkAbandonedCarts() {
    if (!isMailConfigured()) return; // skip silently if SMTP not set up

    try {
        const Customer = require('../models/Customer');
        const now = Date.now();

        // Find customers with a non-empty cart and a snapshot date
        const candidates = await Customer.find({
            'abandonedCart.items.0':    { $exists: true },
            'abandonedCart.snapshotAt': { $exists: true, $ne: null }
        }).select('email firstName abandonedCart');

        for (const customer of candidates) {
            const ac      = customer.abandonedCart;
            const elapsed = now - new Date(ac.snapshotAt).getTime();

            // Reminder 1 — ~1 hour
            if (elapsed >= ONE_HOUR && !ac.emailsSent.reminder1) {
                const ok = await sendAbandonedCartEmail(customer, 1);
                if (ok) {
                    await Customer.findByIdAndUpdate(customer._id,
                        { $set: { 'abandonedCart.emailsSent.reminder1': true } }
                    );
                }
                continue; // one email per check cycle per customer
            }

            // Reminder 2 — ~24 hours
            if (elapsed >= ONE_DAY && ac.emailsSent.reminder1 && !ac.emailsSent.reminder2) {
                const ok = await sendAbandonedCartEmail(customer, 2);
                if (ok) {
                    await Customer.findByIdAndUpdate(customer._id,
                        { $set: { 'abandonedCart.emailsSent.reminder2': true } }
                    );
                }
                continue;
            }

            // Reminder 3 — ~72 hours
            if (elapsed >= THREE_DAYS && ac.emailsSent.reminder2 && !ac.emailsSent.reminder3) {
                await sendAbandonedCartEmail(customer, 3);
                await Customer.findByIdAndUpdate(customer._id,
                    { $set: { 'abandonedCart.emailsSent.reminder3': true } }
                );
            }
        }
    } catch (err) {
        console.error('Abandoned cart job error:', err.message);
    }
}

// ─── Send one abandoned cart email ───────────────────────────────────────────
async function sendAbandonedCartEmail(customer, reminderNumber) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5500';
    const firstName   = customer.firstName || 'there';
    const items       = customer.abandonedCart.items;

    const subjects = {
        1: '🌿 You left something lovely behind',
        2: 'Your plants are still waiting for you',
        3: 'Last chance — they\'re still here for you'
    };

    const intros = {
        1: `<p>Hi ${firstName},</p>
            <p>You left some lovely things in your cart. No rush — they're still here whenever you're ready to come back.</p>`,

        2: `<p>Hi ${firstName},</p>
            <p>Like a seedling quietly reaching for the light, your cart is still waiting for you.
               We thought a gentle reminder might be helpful.</p>`,

        3: `<p>Hi ${firstName},</p>
            <p>This is our last little nudge — we promise. Your cart is still saved, but we
               wanted to make sure you hadn't forgotten these beautiful plants.</p>`
    };

    const itemRows = items.map(item => `
        <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;">
                ${escHtml(item.name)}
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:14px;color:#666;">
                ×${item.quantity}
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;color:#748a53;font-weight:600;">
                $${(item.price * item.quantity).toFixed(2)}
            </td>
        </tr>`).join('');

    const html = `
        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#333;">
            <div style="background:#748a53;padding:24px 32px;">
                <h1 style="color:#fff;font-size:22px;margin:0;font-weight:400;letter-spacing:0.03em;">Hamadryad</h1>
            </div>
            <div style="padding:32px;background:#fff;">
                ${intros[reminderNumber]}
                <table style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #eee;border-radius:6px;overflow:hidden;">
                    <thead>
                        <tr style="background:#f9f9f9;">
                            <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Item</th>
                            <th style="padding:10px 12px;text-align:center;font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Qty</th>
                            <th style="padding:10px 12px;text-align:right;font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Price</th>
                        </tr>
                    </thead>
                    <tbody>${itemRows}</tbody>
                </table>
                <p style="text-align:center;margin:28px 0;">
                    <a href="${frontendUrl}/Cart.html"
                       style="background:#748a53;color:#fff;padding:13px 32px;border-radius:6px;
                              text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">
                        Return to My Cart
                    </a>
                </p>
                <p style="font-size:12px;color:#aaa;text-align:center;margin-top:28px;line-height:1.6;">
                    You're receiving this because you have items in your cart at CultivateNaturally.<br>
                    <a href="${frontendUrl}/Account.html" style="color:#aaa;">Manage your account</a>
                </p>
            </div>
        </div>`;

    try {
        const transporter = getTransporter();
        await transporter.sendMail({
            from:    `"${process.env.SMTP_FROM_NAME || 'CultivateNaturally'}" <${process.env.SMTP_USER}>`,
            to:      customer.email,
            subject: subjects[reminderNumber],
            html
        });
        console.log(`🛒 Abandoned cart email #${reminderNumber} → ${customer.email}`);
        return true;
    } catch (err) {
        console.error(`Failed to send abandoned cart email #${reminderNumber} to ${customer.email}:`, err.message);
        return false;
    }
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = { checkAbandonedCarts, sendAbandonedCartEmail };
