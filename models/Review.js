const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  judgeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Judge', required: true },
  competitorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competitor', required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  type: { type: String, enum: ['rating', 'time', 'text'], required: true }, // ✅ added 'text'
  value: { type: String, required: true }
});

module.exports = mongoose.model('Review', reviewSchema);
