const express  = require('express');
const router   = express.Router();
const Student  = require('../models/Student');
const ExamData = require('../models/ExamData');
const Notice   = require('../models/Notice');
const Faculty  = require('../models/Faculty');

const GRADE_POINTS = { 'O':10,'A+':9,'A':8,'B+':7,'B':6,'C':5,'RA':0,'U':0,'W':0 };

// ── STATS ─────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    const departments   = await Student.distinct('department');
    const batches       = await Student.distinct('batch');
    const totalNotices  = await Notice.countDocuments();
    res.json({ success: true, totalStudents, totalDepartments: departments.length, totalBatches: batches.length, totalNotices });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// ── STUDENTS ─────────────────────────────────
router.get('/students', async (req, res) => {
  try {
    const students = await Student.find().select('-password').sort({ created_at: -1 });
    res.json({ success: true, students });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.post('/students', async (req, res) => {
  try {
    const { register_no, password, name, department, batch, semester } = req.body;
    if (!register_no||!password||!name||!department||!batch||!semester)
      return res.status(400).json({ success: false, message: 'All fields required.' });
    const exists = await Student.findOne({ register_no: register_no.toUpperCase() });
    if (exists) return res.status(400).json({ success: false, message: 'Student already exists.' });
    const student = new Student({ register_no, password, name, department, batch, semester });
    await student.save();
    res.json({ success: true, message: 'Student added!' });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// ── BULK UPLOAD STUDENTS (must be before /:id routes) ───
router.post('/students/bulk', async (req, res) => {
  try {
    const { students } = req.body;
    if (!Array.isArray(students) || students.length === 0)
      return res.status(400).json({ success: false, message: 'No student data provided.' });

    let added = 0, skipped = 0, errors = [];
    for (const s of students) {
      const { register_no, password, name, department, batch, semester } = s;
      if (!register_no || !password || !name || !department || !batch || !semester) {
        errors.push(`Row skipped (missing fields): ${register_no || '?'}`);
        skipped++;
        continue;
      }
      const exists = await Student.findOne({ register_no: register_no.toString().toUpperCase().trim() });
      if (exists) { skipped++; errors.push(`Already exists: ${register_no}`); continue; }
      const student = new Student({
        register_no: register_no.toString().toUpperCase().trim(),
        password: password.toString(),
        name: name.toString().trim(),
        department: department.toString().trim(),
        batch: batch.toString().trim(),
        semester: Number(semester)
      });
      await student.save();
      added++;
    }
    res.json({ success: true, message: `Bulk upload done. Added: ${added}, Skipped: ${skipped}.`, added, skipped, errors });
  } catch(e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error during bulk upload.' });
  }
});

router.delete('/students/:id', async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    await ExamData.deleteOne({ student_id: req.params.id });
    res.json({ success: true, message: 'Student deleted.' });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.put('/students/:id/reset-password', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Not found.' });
    student.password = req.body.new_password;
    await student.save();
    res.json({ success: true, message: 'Password reset!' });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// ── EXAM RESULTS ──────────────────────────────
router.post('/results', async (req, res) => {
  try {
    const { student_id, register_no, semester, subjects } = req.body;
    const enriched = subjects.map(s => ({
      ...s, grade_points: GRADE_POINTS[s.grade]??0,
      total: (Number(s.internal)||0)+(Number(s.external)||0)
    }));
    let tw=0,tc=0;
    enriched.forEach(s=>{tw+=s.grade_points*s.credits;tc+=s.credits;});
    const sgpa = tc>0 ? parseFloat((tw/tc).toFixed(2)) : 0;
    const hasArrear = enriched.some(s=>s.grade==='RA'||s.grade==='U');

    let ed = await ExamData.findOne({ student_id });
    if (!ed) ed = new ExamData({ student_id, register_no, results:[] });
    const idx = ed.results.findIndex(r=>r.semester===Number(semester));
    const semData = { semester:Number(semester), subjects:enriched, sgpa, result: hasArrear?'Arrear':'Pass' };
    if (idx>=0) ed.results[idx]=semData; else ed.results.push(semData);
    ed.results.sort((a,b)=>a.semester-b.semester);
    ed.updated_at = new Date();
    await ed.save();
    res.json({ success: true, message: 'Result saved!', sgpa });
  } catch(e) { console.error(e); res.status(500).json({ success: false, message: 'Server error.' }); }
});

// ── BULK RESULTS UPLOAD (must be before /results/:sid) ──
router.post('/results/bulk', async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || !rows.length)
      return res.status(400).json({ success: false, message: 'No data provided.' });

    let saved=0, skipped=0, errors=[];
    const groups = {};
    for (const row of rows) {
      const key = `${row.register_no}__${row.semester}`;
      if (!groups[key]) groups[key] = { register_no: row.register_no, semester: Number(row.semester), subjects: [] };
      groups[key].subjects.push(row);
    }

    for (const [key, grp] of Object.entries(groups)) {
      const student = await Student.findOne({ register_no: grp.register_no.toString().toUpperCase().trim() });
      if (!student) { skipped++; errors.push(`Student not found: ${grp.register_no}`); continue; }

      const enriched = grp.subjects.map(s => ({
        subject_code: s.subject_code, subject_name: s.subject_name,
        credits: Number(s.credits)||0,
        internal: Number(s.internal)||0, external: Number(s.external)||0,
        total: (Number(s.internal)||0)+(Number(s.external)||0),
        grade: s.grade, grade_points: GRADE_POINTS[s.grade]??0
      }));
      let tw=0,tc=0;
      enriched.forEach(s=>{ tw+=s.grade_points*s.credits; tc+=s.credits; });
      const sgpa = tc>0 ? parseFloat((tw/tc).toFixed(2)) : 0;
      const hasArrear = enriched.some(s=>s.grade==='RA'||s.grade==='U');

      let ed = await ExamData.findOne({ student_id: student._id });
      if (!ed) ed = new ExamData({ student_id: student._id, register_no: student.register_no, results:[] });
      const idx = ed.results.findIndex(r=>r.semester===grp.semester);
      const semData = { semester:grp.semester, subjects:enriched, sgpa, result: hasArrear?'Arrear':'Pass' };
      if (idx>=0) ed.results[idx]=semData; else ed.results.push(semData);
      ed.results.sort((a,b)=>a.semester-b.semester);
      ed.updated_at = new Date();
      await ed.save();
      saved++;
    }
    res.json({ success:true, message:`Bulk results saved. ${saved} student-semesters updated, ${skipped} skipped.`, saved, skipped, errors });
  } catch(e) { console.error(e); res.status(500).json({ success:false, message:'Server error.' }); }
});

router.get('/results/:sid', async (req, res) => {
  try {
    const ed = await ExamData.findOne({ student_id: req.params.sid });
    res.json({ success: true, results: ed?.results||[] });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// ── HALL TICKET ───────────────────────────────
router.post('/hall-ticket', async (req, res) => {
  try {
    const { student_id, register_no, exam_month, exam_centre, subjects } = req.body;
    let ed = await ExamData.findOne({ student_id });
    if (!ed) ed = new ExamData({ student_id, register_no, results:[] });
    ed.hall_ticket = { exam_month, exam_centre, subjects };
    ed.updated_at = new Date();
    await ed.save();
    res.json({ success: true, message: 'Hall ticket saved!' });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.get('/hall-ticket/:sid', async (req, res) => {
  try {
    const ed = await ExamData.findOne({ student_id: req.params.sid });
    res.json({ success: true, hall_ticket: ed?.hall_ticket||null });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// ── EXAM APPLICATION ──────────────────────────
router.post('/exam-application', async (req, res) => {
  try {
    const { student_id, register_no, exam_month, subjects } = req.body;
    let ed = await ExamData.findOne({ student_id });
    if (!ed) ed = new ExamData({ student_id, register_no, results:[] });
    ed.exam_application = { exam_month, status:'Submitted', subjects };
    ed.updated_at = new Date();
    await ed.save();
    res.json({ success: true, message: 'Exam application saved!' });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.get('/exam-application/:sid', async (req, res) => {
  try {
    const ed = await ExamData.findOne({ student_id: req.params.sid });
    res.json({ success: true, exam_application: ed?.exam_application||null });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// ── SEA PERFORMANCE ───────────────────────────
router.post('/sea-performance', async (req, res) => {
  try {
    const { student_id, register_no, semester, subjects } = req.body;
    let ed = await ExamData.findOne({ student_id });
    if (!ed) ed = new ExamData({ student_id, register_no, results:[] });
    ed.sea_performance = { semester:Number(semester), subjects };
    ed.updated_at = new Date();
    await ed.save();
    res.json({ success: true, message: 'SEA Performance saved!' });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.get('/sea-performance/:sid', async (req, res) => {
  try {
    const ed = await ExamData.findOne({ student_id: req.params.sid });
    res.json({ success: true, sea_performance: ed?.sea_performance||null });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// ── NOTICES ───────────────────────────────────
router.get('/notices', async (req, res) => {
  try {
    const notices = await Notice.find().sort({ created_at: -1 });
    res.json({ success: true, notices });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.post('/notices', async (req, res) => {
  try {
    const { title, content, category } = req.body;
    if (!title||!content) return res.status(400).json({ success: false, message: 'Title and content required.' });
    const notice = new Notice({ title, content, category });
    await notice.save();
    res.json({ success: true, message: 'Notice posted!' });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.delete('/notices/:id', async (req, res) => {
  try {
    await Notice.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Notice deleted.' });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// ── FACULTY MANAGEMENT ────────────────────────
router.get('/faculty', async (req, res) => {
  try {
    const faculty = await Faculty.find().select('-password').sort({ department:1, name:1 });
    res.json({ success: true, faculty });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.post('/faculty', async (req, res) => {
  try {
    const { faculty_id, password, name, department, designation, email, phone, allowed_departments, allowed_batches } = req.body;
    if (!faculty_id||!password||!name||!department)
      return res.status(400).json({ success: false, message: 'Faculty ID, password, name and department are required.' });
    const exists = await Faculty.findOne({ faculty_id: faculty_id.toUpperCase() });
    if (exists) return res.status(400).json({ success: false, message: 'Faculty ID already exists.' });
    const faculty = new Faculty({
      faculty_id, password, name, department, designation: designation||'Assistant Professor',
      email, phone,
      allowed_departments: allowed_departments || [],
      allowed_batches: allowed_batches || []
    });
    await faculty.save();
    res.json({ success: true, message: 'Faculty added!' });
  } catch(e) { console.error(e); res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.put('/faculty/:id', async (req, res) => {
  try {
    const { name, department, designation, email, phone, allowed_departments, allowed_batches } = req.body;
    await Faculty.findByIdAndUpdate(req.params.id, { name, department, designation, email, phone, allowed_departments, allowed_batches });
    res.json({ success: true, message: 'Faculty updated!' });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.delete('/faculty/:id', async (req, res) => {
  try {
    await Faculty.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Faculty deleted.' });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.put('/faculty/:id/reset-password', async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id);
    if (!faculty) return res.status(404).json({ success: false, message: 'Not found.' });
    faculty.password = req.body.new_password;
    await faculty.save();
    res.json({ success: true, message: 'Password reset!' });
  } catch(e) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// ── CURRICULUM (from JSON file) ───────────────
router.get('/curriculum', async (req, res) => {
  try {
    const path = require('path');
    const fs   = require('fs');
    const file = path.join(__dirname, '../public/curriculum.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    res.json({ success: true, curriculum: data });
  } catch(e) { res.status(500).json({ success: false, message: 'Curriculum not found.' }); }
});

module.exports = router;
