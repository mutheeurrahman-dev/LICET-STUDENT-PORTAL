// =============================================
//   Attendance Routes - /api/attendance
// =============================================
const express  = require('express');
const router   = express.Router();
const Student  = require('../models/Student');
const { Attendance, ClassSession } = require('../models/Attendance');

// ═══════════════════════════════════════════
//   FACULTY ROUTES  (requireFaculty applied in server.js)
// ═══════════════════════════════════════════

// GET /api/attendance/faculty/students
// Returns students faculty can mark attendance for
router.get('/faculty/students', async (req, res) => {
  try {
    const fac = req.session.faculty;
    const filter = {};
    if (fac.allowed_departments && fac.allowed_departments.length)
      filter.department = { $in: fac.allowed_departments };
    if (fac.allowed_batches && fac.allowed_batches.length)
      filter.batch = { $in: fac.allowed_batches };
    const students = await Student.find(filter).select('-password').sort({ name: 1 });
    res.json({ success: true, students });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// POST /api/attendance/faculty/session
// Mark live class attendance for a session
router.post('/faculty/session', async (req, res) => {
  try {
    const fac = req.session.faculty;
    const { subject_code, subject_name, department, batch, semester, date, period, records } = req.body;
    if (!subject_code || !date || !records || !records.length)
      return res.status(400).json({ success: false, message: 'Missing required fields.' });

    const session = new ClassSession({
      faculty_id:   fac.id,
      faculty_name: fac.name,
      subject_code, subject_name, department, batch,
      semester: Number(semester), date, period,
      records
    });
    await session.save();

    // Now update each student's Attendance document
    for (const rec of records) {
      let att = await Attendance.findOne({ student_id: rec.student_id });
      if (!att) {
        const stu = await Student.findById(rec.student_id).select('name department semester register_no');
        att = new Attendance({
          student_id: rec.student_id, register_no: rec.register_no,
          name: stu?.name, department: stu?.department, semester: stu?.semester,
          weekly_updates: [], subject_totals: []
        });
      }
      // Update subject total
      let subj = att.subject_totals.find(s => s.subject_code === subject_code);
      if (!subj) {
        att.subject_totals.push({ subject_code, subject_name, classes_held: 0, classes_attended: 0, percentage: 0 });
        subj = att.subject_totals[att.subject_totals.length - 1];
      }
      subj.classes_held += 1;
      if (rec.status === 'Present' || rec.status === 'OD' || rec.status === 'Late')
        subj.classes_attended += 1;
      subj.percentage = parseFloat(((subj.classes_attended / subj.classes_held) * 100).toFixed(1));
      att.updated_at = new Date();
      await att.save();
    }

    res.json({ success: true, message: `Attendance saved for ${records.length} students.` });
  } catch(e) { console.error(e); res.status(500).json({ success: false, message: 'Server error.' }); }
});

// GET /api/attendance/faculty/sessions
// Get recent sessions conducted by this faculty
router.get('/faculty/sessions', async (req, res) => {
  try {
    const fac = req.session.faculty;
    const sessions = await ClassSession.find({ faculty_id: fac.id })
      .sort({ date: -1, created_at: -1 }).limit(30);
    res.json({ success: true, sessions });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// POST /api/attendance/faculty/weekly
// Faculty posts a weekly attendance summary for a group of students
router.post('/faculty/weekly', async (req, res) => {
  try {
    const { week_label, entries } = req.body;
    // entries: [{ student_id, register_no, subjects: [{subject_code, subject_name, classes_held, classes_attended}] }]
    if (!entries || !entries.length)
      return res.status(400).json({ success: false, message: 'No data provided.' });

    let updated = 0;
    for (const entry of entries) {
      let att = await Attendance.findOne({ student_id: entry.student_id });
      if (!att) {
        const stu = await Student.findById(entry.student_id).select('name department semester register_no');
        att = new Attendance({
          student_id: entry.student_id, register_no: entry.register_no,
          name: stu?.name, department: stu?.department, semester: stu?.semester,
          weekly_updates: [], subject_totals: []
        });
      }

      // Compute percentages and add weekly snapshot
      const weekSubjects = entry.subjects.map(s => ({
        subject_code: s.subject_code, subject_name: s.subject_name,
        classes_held: Number(s.classes_held) || 0,
        classes_attended: Number(s.classes_attended) || 0,
        percentage: s.classes_held > 0
          ? parseFloat(((s.classes_attended / s.classes_held) * 100).toFixed(1)) : 0
      }));

      // Add weekly update snapshot
      att.weekly_updates.push({ week_label: week_label || `Week ${att.weekly_updates.length + 1}`, subjects: weekSubjects });

      // Update cumulative subject_totals
      for (const ws of weekSubjects) {
        let subj = att.subject_totals.find(s => s.subject_code === ws.subject_code);
        if (!subj) {
          att.subject_totals.push({ ...ws });
        } else {
          // Recalculate cumulative
          subj.classes_held     += ws.classes_held;
          subj.classes_attended += ws.classes_attended;
          subj.percentage = subj.classes_held > 0
            ? parseFloat(((subj.classes_attended / subj.classes_held) * 100).toFixed(1)) : 0;
          subj.subject_name = ws.subject_name;
        }
      }
      att.updated_at = new Date();
      await att.save();
      updated++;
    }
    res.json({ success: true, message: `Weekly attendance updated for ${updated} students.` });
  } catch(e) { console.error(e); res.status(500).json({ success: false, message: 'Server error.' }); }
});

// GET /api/attendance/faculty/student/:studentId
// Get a specific student's attendance (faculty view)
router.get('/faculty/student/:studentId', async (req, res) => {
  try {
    const att = await Attendance.findOne({ student_id: req.params.studentId });
    res.json({ success: true, attendance: att || null });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// GET /api/attendance/faculty/class-summary
// Summary of all students' attendance for faculty's students
router.get('/faculty/class-summary', async (req, res) => {
  try {
    const fac = req.session.faculty;
    const filter = {};
    if (fac.allowed_departments && fac.allowed_departments.length)
      filter.department = { $in: fac.allowed_departments };
    const records = await Attendance.find(filter).sort({ name: 1 });
    res.json({ success: true, records });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// ═══════════════════════════════════════════
//   STUDENT ROUTES  (requireLogin applied in server.js)
// ═══════════════════════════════════════════

// GET /api/attendance/student/my
// Student views their own attendance
router.get('/student/my', async (req, res) => {
  try {
    const att = await Attendance.findOne({ student_id: req.session.student.id });
    res.json({ success: true, attendance: att || null });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

module.exports = router;
