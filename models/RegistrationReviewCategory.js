const mongoose = require('mongoose');

const registrationReviewCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['rating', 'text'],
    required: true,
    default: 'rating'
  },
  active: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

registrationReviewCategorySchema.index({ active: 1, order: 1, name: 1 });

module.exports = mongoose.model('RegistrationReviewCategory', registrationReviewCategorySchema);
