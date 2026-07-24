const mongoose = require('mongoose');

const clubSchema = new mongoose.Schema({
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
  regionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Region',
    default: null,
    index: true
  },
  regionNameSnapshot: {
    type: String,
    default: '',
    trim: true
  }
}, { timestamps: true });

clubSchema.index({ active: 1 });
clubSchema.index({ regionId: 1, active: 1 });

module.exports = mongoose.model('Club', clubSchema);
