const mongoose = require('mongoose');

const timingSchema = new mongoose.Schema({
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RegistrationTimingCategory',
    required: true
  },
  categoryNameSnapshot: {
    type: String,
    required: true,
    trim: true
  },
  value: {
    type: String,
    default: '',
    trim: true
  }
}, { _id: false });

const competitorRegistrationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  surname: {
    type: String,
    default: '',
    trim: true
  },
  clubId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Club',
    required: true
  },
  clubNameSnapshot: {
    type: String,
    required: true,
    trim: true
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
  },
  competitionCategory: {
    type: String,
    enum: ['Under 2 years', 'Over 2 years'],
    required: true
  },
  timings: [timingSchema],
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
    index: true
  },
  rejectionReason: {
    type: String,
    default: '',
    trim: true
  },
  acceptedCompetitorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Competitor',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  reviewedBy: {
    type: String,
    default: '',
    trim: true
  }
}, { timestamps: true });

competitorRegistrationSchema.index({ status: 1, createdAt: -1 });
competitorRegistrationSchema.index({ clubId: 1, status: 1 });
competitorRegistrationSchema.index({ regionId: 1, status: 1 });

module.exports = mongoose.model('CompetitorRegistration', competitorRegistrationSchema);
