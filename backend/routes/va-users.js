const express    = require('express');
const router     = express.Router();
const jwt        = require('jsonwebtoken');
const VAUser     = require('../models/VAUser');
const requireAuth = require('../middleware/auth');

// ── Middleware: VA or Admin auth ───────────────────────────────────────────────
function requireVAOrAdmin(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    try {
        const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// ── VA Login ───────────────────────────────────────────────────────────────────
// POST /api/va/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        const va = await VAUser.findOne({ email: email.toLowerCase() });
        if (!va || !va.isActive) return res.status(401).json({ error: 'Invalid credentials' });

        const match = await va.comparePassword(password);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign(
            { id: va._id, email: va.email, name: va.firstName, role: 'va', permissions: va.permissions },
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );
        res.json({ token, va: { id: va._id, firstName: va.firstName, lastName: va.lastName, email: va.email, permissions: va.permissions } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── VA "me" — VA reads their own profile ────────────────────────────────────
// GET /api/va/me/profile  (must be defined BEFORE /:id routes)
router.get('/me/profile', requireVAOrAdmin, async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'va') return res.status(403).json({ error: 'VA token required' });
        const va = await VAUser.findById(req.user.id).select('-password');
        if (!va) return res.status(404).json({ error: 'VA not found' });
        res.json(va);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── List VAs (admin only) ──────────────────────────────────────────────────────
// GET /api/va
router.get('/', requireAuth, async (req, res) => {
    try {
        const vas = await VAUser.find()
            .select('-password -timeEntries -payroll')
            .sort({ createdAt: -1 });
        res.json(vas);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Create VA (admin only) ─────────────────────────────────────────────────────
// POST /api/va
router.post('/', requireAuth, async (req, res) => {
    try {
        const { firstName, lastName, email, password, hourlyRate, permissions, notes } = req.body;
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ error: 'firstName, lastName, email, and password are required' });
        }
        const exists = await VAUser.findOne({ email: email.toLowerCase() });
        if (exists) return res.status(409).json({ error: 'A VA with that email already exists' });

        const va = await VAUser.create({ firstName, lastName, email, password, hourlyRate, permissions, notes });
        res.status(201).json({
            _id: va._id, firstName: va.firstName, lastName: va.lastName,
            email: va.email, isActive: va.isActive, permissions: va.permissions
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Get single VA ──────────────────────────────────────────────────────────────
// GET /api/va/:id
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const va = await VAUser.findById(req.params.id).select('-password');
        if (!va) return res.status(404).json({ error: 'VA not found' });
        res.json(va);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Update VA (admin only) ─────────────────────────────────────────────────────
// PATCH /api/va/:id
router.patch('/:id', requireAuth, async (req, res) => {
    try {
        const allowed = ['firstName', 'lastName', 'email', 'hourlyRate', 'permissions', 'isActive', 'notes'];
        const updates = {};
        allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

        // Password change handled separately
        if (req.body.password) {
            const va = await VAUser.findById(req.params.id);
            if (!va) return res.status(404).json({ error: 'VA not found' });
            va.set(updates);
            va.password = req.body.password; // triggers pre-save hash
            await va.save();
            return res.json({ ok: true });
        }

        const va = await VAUser.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).select('-password');
        if (!va) return res.status(404).json({ error: 'VA not found' });
        res.json(va);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Delete / deactivate VA (admin only) ───────────────────────────────────────
// DELETE /api/va/:id
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        // Soft-delete: deactivate rather than destroy records
        const va = await VAUser.findByIdAndUpdate(req.params.id, { $set: { isActive: false } }, { new: true });
        if (!va) return res.status(404).json({ error: 'VA not found' });
        res.json({ ok: true, message: 'VA deactivated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Clock In ───────────────────────────────────────────────────────────────────
// POST /api/va/:id/clock-in
router.post('/:id/clock-in', requireVAOrAdmin, async (req, res) => {
    try {
        const va = await VAUser.findById(req.params.id);
        if (!va) return res.status(404).json({ error: 'VA not found' });
        if (va.isClockedIn) return res.status(400).json({ error: 'Already clocked in' });

        va.isClockedIn = true;
        va.clockInTime = new Date();
        await va.save();
        res.json({ ok: true, clockInTime: va.clockInTime });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Clock Out ──────────────────────────────────────────────────────────────────
// POST /api/va/:id/clock-out
router.post('/:id/clock-out', requireVAOrAdmin, async (req, res) => {
    try {
        const va = await VAUser.findById(req.params.id);
        if (!va) return res.status(404).json({ error: 'VA not found' });
        if (!va.isClockedIn) return res.status(400).json({ error: 'Not clocked in' });

        const clockOut = new Date();
        const hoursWorked = Math.round(((clockOut - va.clockInTime) / 3600000) * 100) / 100; // round to 2dp

        va.timeEntries.push({
            clockIn:     va.clockInTime,
            clockOut,
            description: req.body.description || '',
            hoursWorked
        });
        va.isClockedIn = false;
        va.clockInTime = null;
        await va.save();

        res.json({ ok: true, hoursWorked, clockOut });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Get time entries ───────────────────────────────────────────────────────────
// GET /api/va/:id/time
router.get('/:id/time', requireAuth, async (req, res) => {
    try {
        const va = await VAUser.findById(req.params.id).select('firstName lastName timeEntries isClockedIn clockInTime hourlyRate');
        if (!va) return res.status(404).json({ error: 'VA not found' });
        res.json({
            name: `${va.firstName} ${va.lastName}`,
            hourlyRate: va.hourlyRate,
            isClockedIn: va.isClockedIn,
            clockInTime: va.clockInTime,
            entries: va.timeEntries.sort((a, b) => new Date(b.clockIn) - new Date(a.clockIn))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Add payroll record (admin only) ────────────────────────────────────────────
// POST /api/va/:id/payroll
router.post('/:id/payroll', requireAuth, async (req, res) => {
    try {
        const { periodLabel, periodStart, periodEnd, hoursWorked, hourlyRate, taxWithheld, notes, isPaid, paidAt } = req.body;
        if (!periodLabel || !periodStart || !periodEnd) {
            return res.status(400).json({ error: 'periodLabel, periodStart, periodEnd required' });
        }

        const va = await VAUser.findById(req.params.id);
        if (!va) return res.status(404).json({ error: 'VA not found' });

        const rate = hourlyRate || va.hourlyRate || 0;
        const hours = hoursWorked || 0;
        const gross = Math.round(rate * hours * 100) / 100;
        const tax   = taxWithheld || 0;
        const net   = Math.round((gross - tax) * 100) / 100;

        va.payroll.push({ periodLabel, periodStart, periodEnd, hoursWorked: hours, hourlyRate: rate, grossPay: gross, taxWithheld: tax, netPay: net, notes, isPaid: isPaid || false, paidAt: isPaid ? (paidAt || new Date()) : null });
        await va.save();

        res.status(201).json(va.payroll[va.payroll.length - 1]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Get payroll records ────────────────────────────────────────────────────────
// GET /api/va/:id/payroll
router.get('/:id/payroll', requireAuth, async (req, res) => {
    try {
        const va = await VAUser.findById(req.params.id).select('firstName lastName payroll hourlyRate');
        if (!va) return res.status(404).json({ error: 'VA not found' });
        res.json({
            name: `${va.firstName} ${va.lastName}`,
            hourlyRate: va.hourlyRate,
            payroll: va.payroll.sort((a, b) => new Date(b.periodStart) - new Date(a.periodStart))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Mark payroll as paid ───────────────────────────────────────────────────────
// PATCH /api/va/:id/payroll/:payrollId
router.patch('/:id/payroll/:payrollId', requireAuth, async (req, res) => {
    try {
        const va = await VAUser.findById(req.params.id);
        if (!va) return res.status(404).json({ error: 'VA not found' });

        const entry = va.payroll.id(req.params.payrollId);
        if (!entry) return res.status(404).json({ error: 'Payroll entry not found' });

        if (req.body.isPaid !== undefined) { entry.isPaid = req.body.isPaid; entry.paidAt = req.body.isPaid ? new Date() : null; }
        if (req.body.notes !== undefined) entry.notes = req.body.notes;
        await va.save();

        res.json(entry);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
