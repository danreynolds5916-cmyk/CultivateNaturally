const express = require('express');
const router = express.Router();
const { Analytics, PageView } = require('../models/Analytics');
const Order = require('../models/Order');
const Product = require('../models/Product');
const requireAuth = require('../middleware/auth');

// Helper: get today's date string YYYY-MM-DD
function today() {
    return new Date().toISOString().slice(0, 10);
}

// POST /api/analytics/track  — public, called from storefront
router.post('/track', async (req, res) => {
    try {
        const { page, referrer, sessionId } = req.body;
        const dateStr = today();
        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

        // Store raw page view
        await PageView.create({
            sessionId: sessionId || null,
            page: page || '/',
            referrer: referrer || '',
            userAgent: req.headers['user-agent'] || '',
            ip,
            date: dateStr,
            timestamp: new Date()
        });

        // Upsert today's analytics record
        await Analytics.findOneAndUpdate(
            { date: dateStr },
            {
                $inc: { pageViews: 1 },
                $setOnInsert: { visitors: 0, bounces: 0, revenue: 0, ordersCount: 0 }
            },
            { upsert: true }
        );

        // Count unique sessions for today to update visitors
        if (sessionId) {
            const uniqueSessions = await PageView.distinct('sessionId', {
                date: dateStr,
                sessionId: { $ne: null }
            });
            await Analytics.findOneAndUpdate(
                { date: dateStr },
                { visitors: uniqueSessions.length }
            );
        }

        res.json({ ok: true });
    } catch (err) {
        // Fail silently for tracking — don't break the user experience
        res.json({ ok: false });
    }
});

// GET /api/analytics/summary  — protected
router.get('/summary', requireAuth, async (req, res) => {
    try {
        const dateStr = today();

        // Today's analytics snapshot
        const todayAnalytics = await Analytics.findOne({ date: dateStr }) || {
            visitors: 0, pageViews: 0, revenue: 0, ordersCount: 0, bounceRate: 0, conversionRate: 0
        };

        // Today's orders from DB
        const todayStart = new Date(dateStr);
        const todayEnd = new Date(dateStr + 'T23:59:59.999Z');
        const todayOrders = await Order.find({
            createdAt: { $gte: todayStart, $lte: todayEnd },
            status: { $in: ['paid', 'processing', 'shipped', 'delivered'] }
        });

        const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
        const avgOrderValue = todayOrders.length > 0 ? todayRevenue / todayOrders.length : 0;

        // Low stock products
        const lowStockProducts = await Product.find({
            $expr: { $lte: ['$stock', '$lowStockThreshold'] },
            status: { $ne: 'discontinued' }
        }).select('name stock lowStockThreshold supplierUrl status').limit(10);

        // Total counts + all-time revenue
        const [totalProducts, totalOrders, allOrders] = await Promise.all([
            Product.countDocuments({ status: 'active' }),
            Order.countDocuments(),
            Order.find({ status: { $in: ['paid', 'processing', 'shipped', 'delivered'] } }).select('total')
        ]);
        const totalRevenue = allOrders.reduce((sum, o) => sum + (o.total || 0), 0);

        res.json({
            today: {
                visitors: todayAnalytics.visitors,
                pageViews: todayAnalytics.pageViews,
                revenue: todayRevenue,
                orders: todayOrders.length,
                avgOrderValue,
                bounceRate: todayAnalytics.bounceRate,
                conversionRate: todayAnalytics.visitors > 0
                    ? ((todayOrders.length / todayAnalytics.visitors) * 100).toFixed(2)
                    : 0
            },
            totals: {
                products: totalProducts,
                orders: totalOrders,
                revenue: totalRevenue
            },
            lowStockProducts
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/analytics/range?start=YYYY-MM-DD&end=YYYY-MM-DD  — protected, for charts
router.get('/range', requireAuth, async (req, res) => {
    try {
        const { start, end } = req.query;
        if (!start || !end) {
            return res.status(400).json({ error: 'start and end date params required' });
        }

        // Daily analytics records
        const dailyAnalytics = await Analytics.find({
            date: { $gte: start, $lte: end }
        }).sort({ date: 1 });

        // Orders in range for revenue chart
        const startDate = new Date(start);
        const endDate = new Date(end + 'T23:59:59.999Z');
        const orders = await Order.find({
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $in: ['paid', 'processing', 'shipped', 'delivered'] }
        });

        // Group orders by date
        const ordersByDate = {};
        orders.forEach(order => {
            const d = order.createdAt.toISOString().slice(0, 10);
            if (!ordersByDate[d]) ordersByDate[d] = { revenue: 0, count: 0 };
            ordersByDate[d].revenue += order.total;
            ordersByDate[d].count += 1;
        });

        // Top products overall in range
        const productRevenue = {};
        orders.forEach(order => {
            (order.items || []).forEach(item => {
                const key = item.productId?.toString() || item.productName;
                if (!productRevenue[key]) {
                    productRevenue[key] = { name: item.productName, revenue: 0, units: 0 };
                }
                productRevenue[key].revenue += item.price * item.quantity;
                productRevenue[key].units += item.quantity;
            });
        });

        const topProducts = Object.values(productRevenue)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        // Traffic sources from PageView referrers in range
        const pageViews = await PageView.find({
            date: { $gte: start, $lte: end }
        }).select('referrer');

        const sources = { direct: 0, organic: 0, social: 0, email: 0, other: 0 };
        pageViews.forEach(pv => {
            const ref = (pv.referrer || '').toLowerCase();
            if (!ref) sources.direct++;
            else if (/google|bing|yahoo|duckduckgo/.test(ref)) sources.organic++;
            else if (/facebook|instagram|twitter|pinterest|tiktok/.test(ref)) sources.social++;
            else if (/mail|email/.test(ref)) sources.email++;
            else sources.other++;
        });

        res.json({ dailyAnalytics, ordersByDate, topProducts, sources, totalOrders: orders.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
