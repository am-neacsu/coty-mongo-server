const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  judgeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Judge', required: true },
  competitorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competitor', required: true }
});

module.exports = mongoose.model('Assignment', assignmentSchema);
