// =============================================
//   Student Model - MongoDB Schema
// =============================================

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const studentSchema = new mongoose.Schema({

  // ── Login Credentials ──
  register_no: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },

  // ── Personal Details ──
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  department: { type: String },
  batch: { type: String },       // e.g. "2021-2025"
  semester: { type: Number },    // current semester
  photo: { type: String },       // file path or URL

  // ── Academic ──
  cgpa_history: [
    {
      semester: Number,
      sgpa: Number,
      credits: Number,
      saved_at: { type: Date, default: Date.now }
    }
  ],

  // ── System ──
  last_login: { type: Date },
  created_at: { type: Date, default: Date.now }

});

// Hash password before saving
studentSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
studentSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('Student', studentSchema);
