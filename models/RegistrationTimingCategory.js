const mongoose = require('mongoose');

const registrationTimingCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
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

registrationTimingCategorySchema.index({ active: 1, order: 1, name: 1 });

module.exports = mongoose.model('RegistrationTimingCategory', registrationTimingCategorySchema);
