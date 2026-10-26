// =============================================
//   Attendance Model
// =============================================
const mongoose = require('mongoose');

// Individual class session record (for live marking)
const sessionSchema = new mongoose.Schema({
  student_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  register_no: { type: String, required: true },
  status:      { type: String, enum: ['Present','Absent','OD','Late'], default: 'Present' }
});

// A single class session conducted by faculty
const classSessionSchema = new mongoose.Schema({
  faculty_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
  faculty_name: { type: String },
  subject_code: { type: String, required: true },
  subject_name: { type: String },
  department:   { type: String, required: true },
  batch:        { type: String },
  semester:     { type: Number, required: true },
  date:         { type: String, required: true },  // "YYYY-MM-DD"
  period:       { type: String },                   // "1st Period", "2nd Period" etc.
  records:      [sessionSchema],
  created_at:   { type: Date, default: Date.now }
});

// Weekly/cumulative attendance summary per student per subject
const subjectAttendanceSchema = new mongoose.Schema({
  subject_code:    { type: String, required: true },
  subject_name:    { type: String },
  classes_held:    { type: Number, default: 0 },
  classes_attended:{ type: Number, default: 0 },
  percentage:      { type: Number, default: 0 }
});

const weeklyUpdateSchema = new mongoose.Schema({
  week_label:  { type: String },   // e.g. "Week 1 (Jun 3 – Jun 7)"
  updated_at:  { type: Date, default: Date.now },
  subjects:    [subjectAttendanceSchema]
});

const attendanceSchema = new mongoose.Schema({
  student_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, unique: true },
  register_no: { type: String, required: true },
  name:        { type: String },
  department:  { type: String },
  semester:    { type: Number },
  // Weekly updates posted by faculty
  weekly_updates: [weeklyUpdateSchema],
  // Overall per-subject cumulative totals (auto-computed from class sessions OR set manually)
  subject_totals: [subjectAttendanceSchema],
  updated_at:  { type: Date, default: Date.now }
});

const ClassSession = mongoose.model('ClassSession', classSessionSchema);
const Attendance   = mongoose.model('Attendance',   attendanceSchema);

module.exports = { Attendance, ClassSession };
