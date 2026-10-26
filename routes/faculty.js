const express  = require('express');
const router   = express.Router();
const Student  = require('../models/Student');
const ExamData = require('../models/ExamData');
const Notice   = require('../models/Notice');

// Helper: build student filter based on faculty access
function buildFilter(faculty) {
  const filter = {};
  if (faculty.allowed_departments && faculty.allowed_departments.length > 0)
    filter.department = { $in: faculty.allowed_departments };
  if (faculty.allowed_batches && faculty.allowed_batches.length > 0)
    filter.batch = { $in: faculty.allowed_batches };
  return filter;
}

// GET /api/faculty/me
router.get('/me', (req, res) => {
  res.json({ success: true, faculty: req.session.faculty });
});

// GET /api/faculty/students — list students faculty can access
router.get('/students', async (req, res) => {
  try {
    const filter = buildFilter(req.session.faculty);
    const students = await Student.find(filter).select('-password').sort({ department:1, name:1 });
    res.json({ success: true, students });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// GET /api/faculty/results/:studentId — view one student's results
router.get('/results/:studentId', async (req, res) => {
  try {
    const ed = await ExamData.findOne({ student_id: req.params.studentId });
    res.json({ success: true, results: ed ? ed.results : [] });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// POST /api/faculty/results — faculty enters/updates results
router.post('/results', async (req, res) => {
  try {
    const { student_id, register_no, semester, subjects } = req.body;
    const GRADE_POINTS = { 'O':10,'A+':9,'A':8,'B+':7,'B':6,'C':5,'RA':0,'U':0,'W':0 };
    const enriched = subjects.map(s => ({
      ...s,
      grade_points: GRADE_POINTS[s.grade] ?? 0,
      total: (Number(s.internal)||0) + (Number(s.external)||0)
    }));
    let tw=0, tc=0;
    enriched.forEach(s => { tw += s.grade_points * s.credits; tc += s.credits; });
    const sgpa = tc > 0 ? parseFloat((tw/tc).toFixed(2)) : 0;
    const hasArrear = enriched.some(s => s.grade==='RA' || s.grade==='U');

    let ed = await ExamData.findOne({ student_id });
    if (!ed) ed = new ExamData({ student_id, register_no, results: [] });
    const idx = ed.results.findIndex(r => r.semester === Number(semester));
    const semData = { semester: Number(semester), subjects: enriched, sgpa, result: hasArrear ? 'Arrear' : 'Pass' };
    if (idx >= 0) ed.results[idx] = semData; else ed.results.push(semData);
    ed.results.sort((a,b) => a.semester - b.semester);
    ed.updated_at = new Date();
    await ed.save();
    res.json({ success: true, message: 'Result saved!', sgpa });
  } catch(e) { console.error(e); res.status(500).json({ success: false, message: 'Server error.' }); }
});

// POST /api/faculty/sea-performance — enter SEA
router.post('/sea-performance', async (req, res) => {
  try {
    const { student_id, register_no, semester, subjects } = req.body;
    let ed = await ExamData.findOne({ student_id });
    if (!ed) ed = new ExamData({ student_id, register_no, results: [] });
    ed.sea_performance = { semester: Number(semester), subjects };
    ed.updated_at = new Date();
    await ed.save();
    res.json({ success: true, message: 'SEA Performance saved!' });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// GET /api/faculty/notices — view notices
router.get('/notices', async (req, res) => {
  try {
    const notices = await Notice.find().sort({ created_at: -1 });
    res.json({ success: true, notices });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// POST /api/faculty/notices — post a notice
router.post('/notices', async (req, res) => {
  try {
    const { title, content, category } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, message: 'Title and content required.' });
    const notice = new Notice({ title, content, category, posted_by: req.session.faculty.name });
    await notice.save();
    res.json({ success: true, message: 'Notice posted!' });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// GET /api/faculty/analysis — FULL CLASS RESULT ANALYSIS
router.get('/analysis', async (req, res) => {
  try {
    const { semester, department, batch } = req.query;
    const filter = buildFilter(req.session.faculty);
    if (department) filter.department = department;
    if (batch) filter.batch = batch;

    const students = await Student.find(filter).select('_id register_no name department batch semester');
    if (!students.length) return res.json({ success: true, analysis: null, message: 'No students found.' });

    const studentIds = students.map(s => s._id);
    const examDocs   = await ExamData.find({ student_id: { $in: studentIds } });

    // Map student_id -> examDoc
    const examMap = {};
    examDocs.forEach(ed => { examMap[ed.student_id.toString()] = ed; });

    const semNum = semester ? Number(semester) : null;

    // Per-student result for the selected semester
    const studentResults = students.map(s => {
      const ed = examMap[s._id.toString()];
      if (!ed) return { ...s._doc || s.toObject(), semResult: null };
      const semRes = semNum
        ? ed.results.find(r => r.semester === semNum)
        : ed.results[ed.results.length - 1];
      return { ...s.toObject(), semResult: semRes || null };
    });

    // Students WITH results for that semester
    const withResults = studentResults.filter(s => s.semResult);

    // ── Stats ──
    const total      = students.length;
    const appeared   = withResults.length;
    const passed     = withResults.filter(s => s.semResult.result !== 'Arrear').length;
    const arrear     = withResults.filter(s => s.semResult.result === 'Arrear').length;
    const sgpas      = withResults.map(s => s.semResult.sgpa).filter(v => v > 0);
    const avgSgpa    = sgpas.length ? (sgpas.reduce((a,b)=>a+b,0)/sgpas.length).toFixed(2) : 0;
    const maxSgpa    = sgpas.length ? Math.max(...sgpas) : 0;
    const minSgpa    = sgpas.length ? Math.min(...sgpas) : 0;

    // ── Grade distribution across ALL subjects ──
    const gradeCounts = { O:0,'A+':0,A:0,'B+':0,B:0,C:0,RA:0,U:0,W:0 };
    withResults.forEach(s => {
      s.semResult.subjects.forEach(sub => {
        if (gradeCounts[sub.grade] !== undefined) gradeCounts[sub.grade]++;
        else gradeCounts[sub.grade] = 1;
      });
    });

    // ── SGPA distribution buckets ──
    const sgpaBuckets = { '9-10':0, '8-9':0, '7-8':0, '6-7':0, 'Below 6':0 };
    sgpas.forEach(v => {
      if (v >= 9) sgpaBuckets['9-10']++;
      else if (v >= 8) sgpaBuckets['8-9']++;
      else if (v >= 7) sgpaBuckets['7-8']++;
      else if (v >= 6) sgpaBuckets['6-7']++;
      else sgpaBuckets['Below 6']++;
    });

    // ── Toppers (top 5 by SGPA) ──
    const toppers = [...withResults]
      .filter(s => s.semResult.sgpa > 0)
      .sort((a,b) => b.semResult.sgpa - a.semResult.sgpa)
      .slice(0, 5)
      .map(s => ({ name: s.name, register_no: s.register_no, department: s.department, sgpa: s.semResult.sgpa }));

    // ── Arrear students list ──
    const arrearList = withResults
      .filter(s => s.semResult.result === 'Arrear')
      .map(s => ({
        name: s.name, register_no: s.register_no, department: s.department,
        sgpa: s.semResult.sgpa,
        arrearSubjects: s.semResult.subjects.filter(sub => sub.grade==='RA'||sub.grade==='U').map(sub=>sub.subject_name)
      }));

    // ── Subject-wise pass rate ──
    const subjectMap = {};
    withResults.forEach(s => {
      s.semResult.subjects.forEach(sub => {
        if (!subjectMap[sub.subject_code]) subjectMap[sub.subject_code] = { name: sub.subject_name, pass:0, fail:0 };
        if (sub.grade==='RA'||sub.grade==='U') subjectMap[sub.subject_code].fail++;
        else subjectMap[sub.subject_code].pass++;
      });
    });
    const subjectWise = Object.entries(subjectMap).map(([code, v]) => ({
      code, name: v.name, pass: v.pass, fail: v.fail,
      total: v.pass+v.fail,
      passRate: v.pass+v.fail > 0 ? ((v.pass/(v.pass+v.fail))*100).toFixed(1) : 0
    }));

    res.json({
      success: true,
      analysis: {
        total, appeared, passed, arrear,
        passPercent: appeared > 0 ? ((passed/appeared)*100).toFixed(1) : 0,
        avgSgpa, maxSgpa, minSgpa,
        gradeCounts, sgpaBuckets,
        toppers, arrearList, subjectWise,
        semester: semNum,
        studentResults: withResults.map(s => ({
          name: s.name, register_no: s.register_no, department: s.department,
          sgpa: s.semResult.sgpa, result: s.semResult.result
        }))
      }
    });
  } catch(e) { console.error(e); res.status(500).json({ success: false, message: 'Server error.' }); }
});

module.exports = router;
