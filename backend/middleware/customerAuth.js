/**
 * middleware/customerAuth.js
 * JWT authentication middleware for customer-facing routes.
 * Sets req.customer = decoded JWT payload.
 * Explicitly rejects admin tokens (role !== 'customer').
 */
const jwt = require('jsonwebtoken');

module.exports = function requireCustomer(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.slice(7);
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role !== 'customer') {
            return res.status(403).json({ error: 'Customer access required' });
        }

        req.customer = decoded; // { id, email, firstName, lastName, role }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token. Please sign in again.' });
    }
};
