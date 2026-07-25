const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  judgeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Judge', required: true, index: true },
  competitorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competitor', required: true, index: true }
}, { timestamps: true });

assignmentSchema.index({ judgeId: 1, competitorId: 1 }, { unique: true });

module.exports = mongoose.model('Assignment', assignmentSchema);
