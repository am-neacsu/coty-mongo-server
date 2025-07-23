const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['rating', 'time', 'text'], default: 'rating' },
  mandatory: { type: Boolean, default: false } // Only used when type === 'text'
});

module.exports = mongoose.model('Category', CategorySchema);
