const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const facultySchema = new mongoose.Schema({
  faculty_id:  { type: String, required: true, unique: true, uppercase: true, trim: true },
  password:    { type: String, required: true },
  name:        { type: String, required: true },
  department:  { type: String, required: true },
  designation: { type: String, default: 'Assistant Professor' },
  email:       { type: String },
  phone:       { type: String },
  // Admin assigns which departments/batches faculty can see
  // Empty array = see all (admin can set this)
  allowed_departments: [{ type: String }],
  allowed_batches:     [{ type: String }],
  created_at:  { type: Date, default: Date.now }
});

facultySchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

facultySchema.methods.comparePassword = function(plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('Faculty', facultySchema);
