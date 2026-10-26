// =============================================
//   Admin Model - MongoDB Schema
// =============================================

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name:     { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

adminSchema.methods.comparePassword = function(plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('Admin', adminSchema);
