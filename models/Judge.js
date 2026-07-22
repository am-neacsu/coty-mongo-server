const mongoose = require('mongoose');

const JudgeSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  location: { type: String, default: '', trim: true },
  table: { type: String, default: '', trim: true }
}, { timestamps: true });

module.exports = mongoose.model('Judge', JudgeSchema);
