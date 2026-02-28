const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: String,
    sku: String,
    price: Number,
    quantity: Number
}, { _id: false });

const orderSchema = new mongoose.Schema({
    stripeSessionId: { type: String, unique: true, sparse: true },
    stripePaymentIntentId: { type: String },
    items: [orderItemSchema],
    subtotal: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, default: 'usd' },
    customerEmail: { type: String },
    customerName: { type: String },
    shippingAddress: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        postalCode: String,
        country: String
    },
    status: {
        type: String,
        enum: ['pending', 'paid', 'processing', 'shipped', 'delivered', 'refunded', 'cancelled'],
        default: 'pending'
    },
    trackingNumber: { type: String, default: '' },
    trackingCarrier: { type: String, default: '' },
    notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
