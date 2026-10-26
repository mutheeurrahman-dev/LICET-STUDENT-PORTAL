require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const session    = require('express-session');
const MongoStore = require('connect-mongo');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 2 }
}));

// ── Middleware ──────────────────────────────
function requireLogin(req, res, next) {
  if (!req.session.student) return res.redirect('/login');
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.redirect('/login');
  next();
}
function requireFaculty(req, res, next) {
  if (!req.session.faculty) return res.redirect('/login');
  next();
}

// ── API Routes ───────────────────────────────
const authRoutes       = require('./routes/auth');
const cgpaRoutes       = require('./routes/cgpa');
const studentRoutes    = require('./routes/student');
const adminRoutes      = require('./routes/admin');
const facultyRoutes    = require('./routes/faculty');
const attendanceRoutes = require('./routes/attendance');

app.use('/api/auth',    authRoutes);
app.use('/api/cgpa',    requireLogin,   cgpaRoutes);
app.use('/api/student', requireLogin,   studentRoutes);
app.use('/api/admin',   requireAdmin,   adminRoutes);
app.use('/api/faculty', requireFaculty, facultyRoutes);

// Attendance: single mount, middleware checked per-sub-route inside attendance.js
app.use('/api/attendance', (req, res, next) => {
  if (req.path.startsWith('/faculty')) {
    return requireFaculty(req, res, next);
  }
  if (req.path.startsWith('/student')) {
    return requireLogin(req, res, next);
  }
  next();
}, attendanceRoutes);

// ── Root ─────────────────────────────────────
app.get('/', (req, res) => {
  if (req.session.admin)   return res.redirect('/admin');
  if (req.session.faculty) return res.redirect('/faculty');
  if (req.session.student) return res.redirect('/home');
  res.redirect('/login');
});

// ── Public ───────────────────────────────────
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ── Admin Pages ──────────────────────────────
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ── Faculty Pages ────────────────────────────
app.get('/faculty', requireFaculty, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'faculty.html'));
});

// ── Student Pages ────────────────────────────
const protectedPages = [
  ['/home',               'home.html'],
  ['/cgpa-calculator',    'cgpa_calculator.html'],
  ['/notice-board',       'notice_board.html'],
  ['/exam-application',   'exam_application.html'],
  ['/hall-ticket',        'hall_ticket.html'],
  ['/exam-result',        'exam_result.html'],
  ['/sea-performance',    'sea_performance.html'],
  ['/photo-copy',         'photo_copy.html'],
  ['/reval-application',  'reval_application.html'],
  ['/reval-result',       'reval_result.html'],
  ['/review-application', 'review_application.html'],
  ['/review-result',      'review_result.html'],
  ['/profile',            'profile.html'],
  ['/support',            'support.html'],
  ['/login-history',      'login_history.html'],
  ['/attendance',         'attendance.html'],
];

protectedPages.forEach(([route, file]) => {
  app.get(route, requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', file));
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.listen(PORT, () => {
  console.log(`🚀 LICET Portal running at http://localhost:${PORT}`);
});
