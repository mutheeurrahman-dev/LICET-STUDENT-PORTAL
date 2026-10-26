// =============================================
//   CGPA Record Model - MongoDB Schema
// =============================================

const mongoose = require('mongoose');

// Individual subject in a semester
const subjectSchema = new mongoose.Schema({
  subject_code:  { type: String },
  subject_name:  { type: String, required: true },
  credits:       { type: Number, required: true },
  grade:         { type: String, required: true },  // e.g. "O", "A+", "A", "B+", "B", "C", "U"
  grade_points:  { type: Number, required: true }   // O=10, A+=9, A=8, B+=7, B=6, C=5, U=0
});

// One semester record
const semesterRecordSchema = new mongoose.Schema({
  semester:      { type: Number, required: true },
  subjects:      [subjectSchema],
  sgpa:          { type: Number },   // calculated
  total_credits: { type: Number },   // calculated
  saved_at:      { type: Date, default: Date.now }
});

// Full CGPA document per student
const cgpaSchema = new mongoose.Schema({
  student_id:  {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  register_no: { type: String, required: true },
  semesters:   [semesterRecordSchema],
  cgpa:        { type: Number },     // overall CGPA across all semesters
  updated_at:  { type: Date, default: Date.now }
});

module.exports = mongoose.model('CGPARecord', cgpaSchema);
