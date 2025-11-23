const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },

  type: { 
    type: String, 
    enum: ['rating', 'time', 'text'], 
    default: 'rating' 
  },

  mandatory: { 
    type: Boolean, 
    default: false 
  }, // Only used when type === 'text'

  // NEW FIELD:
  // Leave empty = category visible to all judges
  // Add judge IDs = visible only for those judges
  visibleToJudges: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Judge',
      default: [],
    }
  ]
});

module.exports = mongoose.model('Category', CategorySchema);
