// =============================================
//   CGPA Routes - /api/cgpa
// =============================================

const express    = require('express');
const router     = express.Router();
const CGPARecord = require('../models/CGPARecord');

// ── Grade Points Map (Anna University / LICET grading) ──
const GRADE_POINTS = {
  'O':  10,
  'A+':  9,
  'A':   8,
  'B+':  7,
  'B':   6,
  'C':   5,
  'RA':  0,   // Reappear
  'U':   0,   // Fail
  'W':   0    // Withheld
};

// ── Helper: Calculate SGPA for a list of subjects ──
function calculateSGPA(subjects) {
  let totalWeighted = 0;
  let totalCredits  = 0;
  for (const sub of subjects) {
    totalWeighted += sub.grade_points * sub.credits;
    totalCredits  += sub.credits;
  }
  if (totalCredits === 0) return 0;
  return parseFloat((totalWeighted / totalCredits).toFixed(2));
}

// ── Helper: Calculate CGPA from all semesters ──
function calculateCGPA(semesters) {
  let totalWeighted = 0;
  let totalCredits  = 0;
  for (const sem of semesters) {
    for (const sub of sem.subjects) {
      totalWeighted += sub.grade_points * sub.credits;
      totalCredits  += sub.credits;
    }
  }
  if (totalCredits === 0) return 0;
  return parseFloat((totalWeighted / totalCredits).toFixed(2));
}

// ── POST /api/cgpa/save ──────────────────────
// Save or update a semester's data for the logged-in student
router.post('/save', async (req, res) => {
  try {
    const { semester, subjects } = req.body;
    const { id: student_id, register_no } = req.session.student;

    if (!semester || !subjects || !Array.isArray(subjects)) {
      return res.status(400).json({ success: false, message: 'Invalid data.' });
    }

    // Attach grade_points from grade
    const enrichedSubjects = subjects.map(sub => ({
      ...sub,
      grade_points: GRADE_POINTS[sub.grade] ?? 0
    }));

    const sgpa          = calculateSGPA(enrichedSubjects);
    const total_credits = enrichedSubjects.reduce((sum, s) => sum + s.credits, 0);

    // Find or create record
    let record = await CGPARecord.findOne({ student_id });

    if (!record) {
      record = new CGPARecord({ student_id, register_no, semesters: [] });
    }

    // Update or insert semester
    const semIndex = record.semesters.findIndex(s => s.semester === Number(semester));
    const semData  = { semester: Number(semester), subjects: enrichedSubjects, sgpa, total_credits, saved_at: new Date() };

    if (semIndex >= 0) {
      record.semesters[semIndex] = semData;
    } else {
      record.semesters.push(semData);
    }

    // Sort semesters
    record.semesters.sort((a, b) => a.semester - b.semester);

    // Recalculate overall CGPA
    record.cgpa       = calculateCGPA(record.semesters);
    record.updated_at = new Date();

    await record.save();

    res.json({ success: true, message: 'CGPA saved successfully!', sgpa, cgpa: record.cgpa });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/cgpa/my ─────────────────────────
// Get all CGPA records for logged-in student
router.get('/my', async (req, res) => {
  try {
    const record = await CGPARecord.findOne({ student_id: req.session.student.id });
    if (!record) {
      return res.json({ success: true, semesters: [], cgpa: 0 });
    }
    res.json({ success: true, semesters: record.semesters, cgpa: record.cgpa });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── DELETE /api/cgpa/semester/:sem ───────────
// Delete a specific semester record
router.delete('/semester/:sem', async (req, res) => {
  try {
    const semNum = Number(req.params.sem);
    const record = await CGPARecord.findOne({ student_id: req.session.student.id });
    if (!record) return res.status(404).json({ success: false, message: 'No record found.' });

    record.semesters = record.semesters.filter(s => s.semester !== semNum);
    record.cgpa      = calculateCGPA(record.semesters);
    await record.save();

    res.json({ success: true, message: `Semester ${semNum} deleted.`, cgpa: record.cgpa });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── GET /api/cgpa/grades ─────────────────────
// Return the grade scale reference
router.get('/grades', (req, res) => {
  res.json({ success: true, grades: GRADE_POINTS });
});

module.exports = router;
