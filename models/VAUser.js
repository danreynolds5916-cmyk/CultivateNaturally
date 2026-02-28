const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const timeEntrySchema = new mongoose.Schema({
    clockIn:     { type: Date, required: true },
    clockOut:    { type: Date },
    description: { type: String, default: '' },
    hoursWorked: { type: Number, default: 0 }   // computed on clock-out
}, { _id: true });

const payrollEntrySchema = new mongoose.Schema({
    periodLabel:  { type: String, required: true },  // e.g. "2025-W12" or "March 2025"
    periodStart:  { type: Date, required: true },
    periodEnd:    { type: Date, required: true },
    hoursWorked:  { type: Number, default: 0 },
    hourlyRate:   { type: Number, default: 0 },
    grossPay:     { type: Number, default: 0 },
    taxWithheld:  { type: Number, default: 0 },
    netPay:       { type: Number, default: 0 },
    notes:        { type: String, default: '' },
    paidAt:       { type: Date },
    isPaid:       { type: Boolean, default: false }
}, { _id: true, timestamps: true });

const vaUserSchema = new mongoose.Schema({
    firstName:   { type: String, required: true, trim: true },
    lastName:    { type: String, required: true, trim: true },
    email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:    { type: String, required: true, minlength: 8 },
    isActive:    { type: Boolean, default: true },
    hourlyRate:  { type: Number, default: 0 },
    notes:       { type: String, default: '' },   // admin notes (e.g. contract details)

    // CMS permissions
    permissions: {
        products:  { type: Boolean, default: false },
        blog:      { type: Boolean, default: false },
        marketing: { type: Boolean, default: false },
        email:     { type: Boolean, default: false },
        analytics: { type: Boolean, default: false },
        orders:    { type: Boolean, default: false }
    },

    // Time tracking
    isClockedIn:  { type: Boolean, default: false },
    clockInTime:  { type: Date },
    timeEntries:  [timeEntrySchema],

    // Payroll history
    payroll: [payrollEntrySchema]
}, { timestamps: true });

// Hash password before save
vaUserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

vaUserSchema.methods.comparePassword = function (plain) {
    return bcrypt.compare(plain, this.password);
};

// Virtual: full name
vaUserSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model('VAUser', vaUserSchema);
