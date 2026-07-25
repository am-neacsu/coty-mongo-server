const mongoose = require('mongoose');

const registrationHeatSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  location: {
    type: String,
    default: '',
    trim: true
  },
  date: {
    type: Date,
    default: null
  },
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  order: {
    type: Number,
    default: 0,
    index: true
  }
}, { timestamps: true });

registrationHeatSchema.index({ active: 1, order: 1, name: 1 });

module.exports = mongoose.model('RegistrationHeat', registrationHeatSchema);
