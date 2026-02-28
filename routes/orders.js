const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const requireAuth = require('../middleware/auth');

// ─── Stripe Webhook (raw body, mounted in server.js before json middleware) ───
async function webhook(req, res) {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Stripe webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        try {
            // Avoid duplicate orders from retried webhooks
            const existing = await Order.findOne({ stripeSessionId: session.id });
            if (!existing) {
                // Retrieve line items to build order items
                const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });

                const items = lineItems.data.map(item => ({
                    productName: item.description,
                    price: item.price.unit_amount / 100,
                    quantity: item.quantity
                }));

                await Order.create({
                    stripeSessionId: session.id,
                    stripePaymentIntentId: session.payment_intent,
                    items,
                    total: session.amount_total / 100,
                    currency: session.currency,
                    customerEmail: session.customer_details?.email,
                    customerName: session.customer_details?.name,
                    shippingAddress: session.shipping_details?.address
                        ? {
                            line1: session.shipping_details.address.line1,
                            line2: session.shipping_details.address.line2,
                            city: session.shipping_details.address.city,
                            state: session.shipping_details.address.state,
                            postalCode: session.shipping_details.address.postal_code,
                            country: session.shipping_details.address.country
                        }
                        : undefined,
                    status: 'paid'
                });

                // Clear abandoned cart for logged-in customer (order completed)
                const completedEmail = session.customer_details?.email?.toLowerCase();
                if (completedEmail) {
                    try {
                        const Customer = require('../models/Customer');
                        await Customer.findOneAndUpdate(
                            { email: completedEmail },
                            {
                                $set: {
                                    'abandonedCart.items':                [],
                                    'abandonedCart.snapshotAt':           null,
                                    'abandonedCart.lastActivity':         null,
                                    'abandonedCart.emailsSent.reminder1': false,
                                    'abandonedCart.emailsSent.reminder2': false,
                                    'abandonedCart.emailsSent.reminder3': false
                                }
                            }
                        );
                    } catch (cartErr) {
                        console.error('Failed to clear abandoned cart:', cartErr.message);
                    }
                }

                // Capture customer email for newsletter list (soft opt-in from purchase)
                const customerEmail = session.customer_details?.email;
                if (customerEmail) {
                    try {
                        const Subscriber = require('../models/Subscriber');
                        const existingSub = await Subscriber.findOne({ email: customerEmail.toLowerCase() });
                        if (!existingSub) {
                            await Subscriber.create({
                                email: customerEmail.toLowerCase(),
                                source: 'order',
                                tags: ['customer']
                            });
                        } else if (!existingSub.tags.includes('customer')) {
                            existingSub.tags.push('customer');
                            await existingSub.save();
                        }
                    } catch (subErr) {
                        // Non-fatal — don't fail order processing over this
                        console.error('Subscriber capture error:', subErr.message);
                    }
                }

                // Update analytics revenue
                const { Analytics } = require('../models/Analytics');
                const dateStr = new Date().toISOString().slice(0, 10);
                await Analytics.findOneAndUpdate(
                    { date: dateStr },
                    {
                        $inc: { revenue: session.amount_total / 100, ordersCount: 1 },
                        $setOnInsert: { visitors: 0, pageViews: 0, bounces: 0 }
                    },
                    { upsert: true }
                );
            }
        } catch (err) {
            console.error('Error saving order:', err);
        }
    }

    res.json({ received: true });
}

// ─── GET /api/orders  — protected, paginated ───────────────────────────────
router.get('/', requireAuth, async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const filter = {};
        if (status) filter.status = status;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [orders, total] = await Promise.all([
            Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
            Order.countDocuments(filter)
        ]);

        res.json({ orders, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/orders/:id  — protected
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/orders/:id/status  — protected
router.patch('/:id/status', requireAuth, async (req, res) => {
    try {
        const { status, trackingNumber, trackingCarrier, notes } = req.body;
        const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'refunded', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const update = { status };
        if (trackingNumber !== undefined) update.trackingNumber = trackingNumber;
        if (trackingCarrier !== undefined) update.trackingCarrier = trackingCarrier;
        if (notes !== undefined) update.notes = notes;

        const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/orders/create-checkout-session  — public ────────────────────
// Body: { items: [{productId, name, price, quantity, image}], successUrl, cancelUrl }
router.post('/create-checkout-session', async (req, res) => {
    try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const { items, successUrl, cancelUrl } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'No items provided' });
        }

        const lineItems = items.map(item => {
            const lineItem = {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: item.name,
                        metadata: { productId: item.productId || '' }
                    },
                    unit_amount: Math.round(item.price * 100)
                },
                quantity: item.quantity
            };
            // Attach image if provided and is a valid URL
            if (item.image && item.image.startsWith('http')) {
                lineItem.price_data.product_data.images = [item.image];
            }
            return lineItem;
        });

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: lineItems,
            shipping_address_collection: {
                allowed_countries: ['US', 'CA', 'GB', 'AU']
            },
            shipping_options: [
                {
                    shipping_rate_data: {
                        type: 'fixed_amount',
                        fixed_amount: { amount: 0, currency: 'usd' },
                        display_name: 'Standard Shipping',
                        delivery_estimate: {
                            minimum: { unit: 'business_day', value: 5 },
                            maximum: { unit: 'business_day', value: 10 }
                        }
                    }
                },
                {
                    shipping_rate_data: {
                        type: 'fixed_amount',
                        fixed_amount: { amount: 1499, currency: 'usd' },
                        display_name: 'Express Shipping',
                        delivery_estimate: {
                            minimum: { unit: 'business_day', value: 2 },
                            maximum: { unit: 'business_day', value: 3 }
                        }
                    }
                }
            ],
            customer_email: req.body.customerEmail || undefined,
            success_url: successUrl || `${process.env.FRONTEND_URL}/Checkout.html?success=1&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/Cart.html?cancelled=1`,
            metadata: {
                source: 'cultivatenaturally-storefront'
            }
        });

        res.json({ url: session.url, sessionId: session.id });
    } catch (err) {
        console.error('Stripe session creation error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/orders/by-email  — public customer order lookup ──────────────
// Query: ?email=customer@example.com
router.get('/by-email', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Valid email required' });
        }

        const orders = await Order.find(
            { customerEmail: email.toLowerCase().trim() },
            // Return only safe fields — no internal IDs or payment details
            'items total currency status createdAt shippingAddress trackingNumber customerName stripeSessionId'
        )
            .sort({ createdAt: -1 })
            .limit(50);

        // Map to a clean public shape
        const publicOrders = orders.map(o => ({
            orderId: o._id,
            stripeSessionId: o.stripeSessionId,
            date: o.createdAt,
            status: o.status,
            total: o.total,
            currency: o.currency,
            items: o.items,
            shippingAddress: o.shippingAddress,
            trackingNumber: o.trackingNumber || null,
            customerName: o.customerName
        }));

        res.json({ orders: publicOrders, count: publicOrders.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = { router, webhook };
