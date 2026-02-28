require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
// Note: Stripe is initialized lazily inside routes/orders.js — not needed here.

const app = express();
app.set('trust proxy', 1);

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    standardHeaders: true,
    legacyHeaders: false
});
app.use(limiter);

// ─── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
    process.env.FRONTEND_URL,
	'https://cultivatenaturally.shop',
    'https://www.cultivatenaturally.shop',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3000'
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// ─── Stripe Webhook (must be before express.json()) ───────────────────────────
app.post('/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    require('./routes/orders').webhook
);

// ─── Body Parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Static Files (uploaded images) ───────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/products',  require('./routes/products'));
app.use('/api/blog',      require('./routes/blog'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/orders',    require('./routes/orders').router);
app.use('/api/newsletter',require('./routes/newsletter'));
app.use('/api/settings',  require('./routes/settings'));
app.use('/api/va',        require('./routes/va-users'));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(err.stack);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
});

// ─── MongoDB + Server Start ───────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB');
        await seedAdmin();
        app.listen(PORT, () => {
            console.log(`🌿 Hamadryad API running on port ${PORT}`);
        });

        // ─── Abandoned Cart Job ─────────────────────────────────────────────
        const { checkAbandonedCarts } = require('./jobs/abandonedCart');
        setInterval(checkAbandonedCarts, 15 * 60 * 1000); // every 15 minutes
        console.log('🛒 Abandoned cart checker started (15-min interval)');
    })
    .catch(err => {
        console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1);
    });

// ─── Seed Default Admin ───────────────────────────────────────────────────────
async function seedAdmin() {
    const Admin = require('./models/Admin');
    const bcrypt = require('bcryptjs');
    const existing = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
    if (!existing) {
        const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
        await Admin.create({ email: process.env.ADMIN_EMAIL, password: hash, name: 'Admin' });
        console.log(`👤 Default admin created: ${process.env.ADMIN_EMAIL}`);
    }
}
