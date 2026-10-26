const mongoose = require('mongoose');

const subjectResultSchema = new mongoose.Schema({
  subject_code: String, subject_name: String, credits: Number,
  internal: Number, external: Number, total: Number, grade: String, grade_points: Number
});
const semesterResultSchema = new mongoose.Schema({
  semester: Number, subjects: [subjectResultSchema], sgpa: Number,
  result: { type: String, enum:['Pass','Fail','Arrear'], default:'Pass' }
});
const hallTicketSubjectSchema = new mongoose.Schema({
  subject_code: String, subject_name: String,
  exam_date: String, exam_time: String, session: { type: String, enum:['FN','AN'], default:'FN' }
});
const examAppSubjectSchema = new mongoose.Schema({
  subject_code: String, subject_name: String,
  subject_type: { type: String, enum:['Theory','Practical'], default:'Theory' },
  credits: Number, status: { type: String, default:'Applied' }
});
const seaSubjectSchema = new mongoose.Schema({
  subject_code: String, subject_name: String,
  internal: Number, external: Number, total: Number,
  max: { type: Number, default:100 }, result: { type: String, enum:['Pass','Fail'], default:'Pass' }
});

const examDataSchema = new mongoose.Schema({
  student_id:  { type: mongoose.Schema.Types.ObjectId, ref:'Student', required:true },
  register_no: { type: String, required:true },
  results:     [semesterResultSchema],
  hall_ticket: {
    exam_month: String, exam_centre: String,
    subjects: [hallTicketSubjectSchema]
  },
  exam_application: {
    exam_month: String, status: { type:String, default:'Submitted' },
    subjects: [examAppSubjectSchema]
  },
  sea_performance: {
    semester: Number, subjects: [seaSubjectSchema]
  },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ExamData', examDataSchema);
