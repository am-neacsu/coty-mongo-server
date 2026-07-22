const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  judgeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Judge', required: true, index: true },
  competitorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competitor', required: true, index: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  type: { type: String, enum: ['rating', 'time', 'text'], required: true },
  value: { type: String, required: true }
}, { timestamps: true });

reviewSchema.index({ judgeId: 1, competitorId: 1, categoryId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
