# LICET Student Portal

A full-stack student portal for Loyola-ICAM College of Engineering and Technology (LICET), Chennai.

## Tech Stack
- **Backend**: Node.js + Express.js
- **Database**: MongoDB (Mongoose)
- **Sessions**: express-session + connect-mongo
- **Frontend**: Plain HTML/CSS/JS

## Quick Start

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
# Edit .env with your MongoDB URI and session secret:
#   MONGO_URI=mongodb://localhost:27017/licet_portal
#   SESSION_SECRET=your_strong_random_secret_here
#   PORT=3000

# 3. Start the server
npm start

# For development with auto-reload:
npm run dev
```

Then open: **http://localhost:3000**

---

## Creating the First Admin Account

There is no default admin. Use this one-time API call to create one:

```bash
curl -X POST http://localhost:3000/api/auth/create-admin \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","name":"Administrator"}'
```

Then log in at `/login` with `admin` / `admin123`.

---

## User Roles & Login

| Role | Login with | Redirects to |
|------|-----------|-------------|
| Admin | Username (e.g. `admin`) | `/admin` |
| Faculty | Faculty ID (e.g. `FAC001`) | `/faculty` |
| Student | Register Number (e.g. `311124201001`) | `/home` |

---

## Features

### Student Portal
- View exam results (semester-wise with SGPA/CGPA)
- Download hall ticket
- View exam application status
- View SEA (Subject Expert Assessment) performance
- CGPA Calculator (manual entry + save to DB)
- Attendance tracking
- Notice board
- Profile management
- Login history

### Faculty Panel
- View assigned students
- Enter exam results & SEA performance
- Mark live class attendance
- Post weekly attendance updates
- View class analysis & toppers
- Post notices

### Admin Panel
- Add / delete students (single + bulk Excel upload)
- Reset student passwords
- Add / delete faculty
- Enter exam results, hall tickets, exam applications, SEA data (single + bulk Excel)
- Post / delete notices
- View portal statistics

---

## Project Structure

```
licet-fixed-patched/
├── server.js           # Express app, routes, session config
├── .env                # Environment variables
├── package.json
├── models/
│   ├── Student.js
│   ├── Admin.js
│   ├── Faculty.js
│   ├── ExamData.js     # Results, hall ticket, exam app, SEA
│   ├── CGPARecord.js   # Student CGPA calculator saves
│   ├── Attendance.js   # Weekly + live attendance
│   └── Notice.js
├── routes/
│   ├── auth.js         # /api/auth — login, logout, me
│   ├── student.js      # /api/student — profile, results, notices
│   ├── admin.js        # /api/admin — full management
│   ├── faculty.js      # /api/faculty — faculty portal
│   ├── cgpa.js         # /api/cgpa — CGPA calculator
│   └── attendance.js   # /api/attendance — mark & view attendance
└── public/             # All HTML pages + assets
```

---

## Bugs Fixed (from original upload)

1. **`routes/admin.js`** — `module.exports` was at line 175, making bulk upload, faculty, curriculum, and bulk results routes completely unreachable (404). Fixed by moving `module.exports` to end of file.
2. **`routes/admin.js`** — `POST /students/bulk` and `POST /results/bulk` were defined after `DELETE /students/:id` and `GET /results/:sid` — Express matched `:id = "bulk"` first. Fixed by reordering specific routes before parameterised ones.
3. **`server.js`** — Attendance routes were double-prefixed: mounted at `/api/attendance/faculty` AND handlers had `/faculty/students` path. Fixed to single mount at `/api/attendance` with per-path middleware.
4. **`cgpa_calculator.html`** — Referenced missing `bootstrap_min.css`. Fixed to Bootstrap 5 CDN.
5. **`routes/student.js`** — Missing `/api/student/notices` and `/api/student/login-history` endpoints. Added both.
6. **`notice_board.html`** — Showed only hardcoded static notices. Now fetches live from DB with static fallback.
7. **`exam_application.html`** — Showed hardcoded subject table. Now dynamically loads from DB.
8. **`models/Notice.js`** — Missing `posted_by` field used by faculty notice posting. Added to schema.
9. **`routes/student.js`** — Duplicate `Notice` require and duplicate `/notices` route registration. Cleaned up.
