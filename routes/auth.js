const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Admin = require('../models/Admin');
const requireAuth = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const admin = await Admin.findOne({ email: email.toLowerCase() });
        if (!admin) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const match = await bcrypt.compare(password, admin.password);
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: admin._id, email: admin.email, name: admin.name, role: 'admin' },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, admin: { id: admin._id, email: admin.email, name: admin.name } });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Both passwords are required' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters' });
        }

        const admin = await Admin.findById(req.admin.id);
        const match = await bcrypt.compare(currentPassword, admin.password);
        if (!match) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        admin.password = await bcrypt.hash(newPassword, 12);
        await admin.save();
        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
    res.json({ admin: req.admin });
});

module.exports = router;
