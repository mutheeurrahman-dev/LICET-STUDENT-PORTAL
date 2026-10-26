// =============================================
//   Student Routes - /api/student
// =============================================

const express   = require('express');
const router    = express.Router();
const Student   = require('../models/Student');
const ExamData  = require('../models/ExamData');
const Notice    = require('../models/Notice');

// ── GET /api/student/profile ─────────────────
router.get('/profile', async (req, res) => {
  try {
    const student = await Student.findById(req.session.student.id).select('-password');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    res.json({ success: true, student });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/student/profile ──────────────────
router.put('/profile', async (req, res) => {
  try {
    const { email, phone } = req.body;
    await Student.findByIdAndUpdate(req.session.student.id, { email, phone });
    res.json({ success: true, message: 'Profile updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── PUT /api/student/change-password ─────────
router.put('/change-password', async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const student = await Student.findById(req.session.student.id);
    const isMatch = await student.comparePassword(current_password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    student.password = new_password;
    await student.save();
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/student/results ─────────────────
router.get('/results', async (req, res) => {
  try {
    const ed = await ExamData.findOne({ student_id: req.session.student.id });
    res.json({ success: true, results: ed ? ed.results : [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/student/hall-ticket ─────────────
router.get('/hall-ticket', async (req, res) => {
  try {
    const ed = await ExamData.findOne({ student_id: req.session.student.id });
    res.json({ success: true, hall_ticket: ed ? ed.hall_ticket : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/student/exam-application ────────
router.get('/exam-application', async (req, res) => {
  try {
    const ed = await ExamData.findOne({ student_id: req.session.student.id });
    res.json({ success: true, exam_application: ed ? ed.exam_application : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/student/sea-performance ─────────
router.get('/sea-performance', async (req, res) => {
  try {
    const ed = await ExamData.findOne({ student_id: req.session.student.id });
    res.json({ success: true, sea_performance: ed ? ed.sea_performance : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/student/notices ──────────────────
router.get('/notices', async (req, res) => {
  try {
    const notices = await Notice.find().sort({ created_at: -1 });
    res.json({ success: true, notices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/student/login-history ───────────
router.get('/login-history', async (req, res) => {
  try {
    const student = await Student.findById(req.session.student.id)
      .select('last_login created_at name register_no');
    if (!student) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, last_login: student.last_login, created_at: student.created_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
