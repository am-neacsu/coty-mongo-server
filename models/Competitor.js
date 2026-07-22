const mongoose = require('mongoose');

const CompetitorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: {
    type: String,
    required: true,
    enum: ['Under 2 years', 'Over 2 years'],
    default: 'Under 2 years'
  },
  location: { type: String, trim: true, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Competitor', CompetitorSchema);
