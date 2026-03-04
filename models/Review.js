const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    productId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    customerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String, required: true },
    rating:       { type: Number, required: true, min: 1, max: 5 },
    title:        { type: String, maxlength: 120 },
    body:         { type: String, maxlength: 2000 }
}, { timestamps: true });

// One review per customer per product
reviewSchema.index({ productId: 1, customerId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
