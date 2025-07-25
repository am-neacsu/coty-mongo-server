const mongoose = require('mongoose');

const CompetitorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true, enum: ['Under 2 years', 'Over 2 years'], default: 'Under 2 years' },
  location: { type: String }
});

module.exports = mongoose.model('Competitor', CompetitorSchema);
