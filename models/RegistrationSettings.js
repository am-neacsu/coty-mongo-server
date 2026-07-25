const mongoose = require('mongoose');

const registrationSettingsSchema = new mongoose.Schema({
  managerPasswordHash: {
    type: String,
    default: ''
  },
  registrationOpen: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('RegistrationSettings', registrationSettingsSchema);
