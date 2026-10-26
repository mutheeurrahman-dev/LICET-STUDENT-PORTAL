const mongoose = require('mongoose');
const noticeSchema = new mongoose.Schema({
  title:      { type: String, required: true },
  content:    { type: String, required: true },
  category:   { type: String, enum: ['Important','Update','Notice','Deadline','Published','General'], default: 'Notice' },
  posted_by:  { type: String, default: 'Admin' },
  created_at: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Notice', noticeSchema);
