const mongoose = require('mongoose');

const CompetitorSchema = new mongoose.Schema({
  name: { type: String, required: true }
});

module.exports = mongoose.model('Competitor', CompetitorSchema);