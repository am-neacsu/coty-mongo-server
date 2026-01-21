const mongoose = require('mongoose');
const JudgeSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  location: { type: String, default: '' },
  table: { type: String, default: '' }
});

module.exports = mongoose.model('Judge', JudgeSchema);