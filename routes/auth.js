const express = require('express');
const router  = express.Router();
const Student = require('../models/Student');
const Admin   = require('../models/Admin');
const Faculty = require('../models/Faculty');

router.post('/login', async (req, res) => {
  try {
    const { register_no, password } = req.body;
    if (!register_no || !password)
      return res.status(400).json({ success: false, message: 'Register number and password are required.' });

    // Check admin
    const admin = await Admin.findOne({ username: register_no });
    if (admin) {
      const isMatch = await admin.comparePassword(password);
      if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials.' });
      req.session.admin = { id: admin._id, username: admin.username, name: admin.name };
      return res.json({ success: true, role: 'admin', redirect: '/admin' });
    }

    // Check faculty
    const faculty = await Faculty.findOne({ faculty_id: register_no.toUpperCase() });
    if (faculty) {
      const isMatch = await faculty.comparePassword(password);
      if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials.' });
      req.session.faculty = {
        id: faculty._id, faculty_id: faculty.faculty_id,
        name: faculty.name, department: faculty.department,
        designation: faculty.designation,
        allowed_departments: faculty.allowed_departments,
        allowed_batches: faculty.allowed_batches
      };
      return res.json({ success: true, role: 'faculty', redirect: '/faculty' });
    }

    // Check student
    const student = await Student.findOne({ register_no: register_no.toUpperCase() });
    if (!student) return res.status(401).json({ success: false, message: 'Invalid register number or password.' });
    const isMatch = await student.comparePassword(password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid register number or password.' });
    student.last_login = new Date();
    await student.save();
    req.session.student = {
      id: student._id, register_no: student.register_no,
      name: student.name, department: student.department,
      semester: student.semester, batch: student.batch
    };
    res.json({ success: true, role: 'student', redirect: '/home' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { register_no, password, name, email, department, batch, semester } = req.body;
    const exists = await Student.findOne({ register_no: register_no.toUpperCase() });
    if (exists) return res.status(400).json({ success: false, message: 'Student already exists.' });
    const student = new Student({ register_no, password, name, email, department, batch, semester });
    await student.save();
    res.json({ success: true, message: 'Student registered successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/create-admin', async (req, res) => {
  try {
    const { username, password, name } = req.body;
    const exists = await Admin.findOne({ username });
    if (exists) return res.status(400).json({ success: false, message: 'Admin already exists.' });
    const admin = new Admin({ username, password, name });
    await admin.save();
    res.json({ success: true, message: 'Admin created successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.get('/me', (req, res) => {
  if (req.session.admin)   return res.json({ success: true, role: 'admin',   admin: req.session.admin });
  if (req.session.faculty) return res.json({ success: true, role: 'faculty', faculty: req.session.faculty });
  if (req.session.student) return res.json({ success: true, role: 'student', student: req.session.student });
  res.status(401).json({ success: false, message: 'Not logged in.' });
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

module.exports = router;
