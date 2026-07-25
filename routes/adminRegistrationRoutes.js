const express = require('express');
const bcrypt = require('bcrypt');

const Region = require('../models/Region');
const RegistrationHeat = require('../models/RegistrationHeat');
const RegistrationSettings = require('../models/RegistrationSettings');
const Club = require('../models/Club');
const RegistrationTimingCategory = require('../models/RegistrationTimingCategory');
const CompetitorRegistration = require('../models/CompetitorRegistration');
const Competitor = require('../models/Competitor');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const adminOnly = [requireAuth, requireAdmin];

async function resolveRegion(regionId) {
  if (!regionId) return { regionId: null, regionNameSnapshot: '' };
  const region = await Region.findById(regionId);
  if (!region) {
    const error = new Error('Region not found');
    error.status = 404;
    throw error;
  }
  return { regionId: region._id, regionNameSnapshot: region.name };
}

async function getRegistrationSettings() {
  let settings = await RegistrationSettings.findOne();
  if (!settings) {
    settings = await RegistrationSettings.create({ registrationOpen: true });
  }
  return settings;
}


// ---------------- REGISTRATION ACCESS SETTINGS ----------------
router.get('/admin/registration-settings', adminOnly, async (req, res) => {
  try {
    const settings = await getRegistrationSettings();
    res.json({
      registrationOpen: settings.registrationOpen,
      hasManagerPassword: !!settings.managerPasswordHash
    });
  } catch (err) {
    console.error('Error fetching registration settings:', err);
    res.status(500).json({ message: 'Server error fetching registration settings' });
  }
});

router.put('/admin/registration-settings', adminOnly, async (req, res) => {
  try {
    const settings = await getRegistrationSettings();
    if (typeof req.body.registrationOpen === 'boolean') {
      settings.registrationOpen = req.body.registrationOpen;
    }
    await settings.save();
    res.json({
      registrationOpen: settings.registrationOpen,
      hasManagerPassword: !!settings.managerPasswordHash
    });
  } catch (err) {
    console.error('Error updating registration settings:', err);
    res.status(500).json({ message: 'Server error updating registration settings' });
  }
});

router.put('/admin/registration-settings/password', adminOnly, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || String(password).trim().length < 4) {
      return res.status(400).json({ message: 'Manager password must be at least 4 characters' });
    }

    const settings = await getRegistrationSettings();
    settings.managerPasswordHash = await bcrypt.hash(String(password), 10);
    await settings.save();
    res.json({ success: true, hasManagerPassword: true });
  } catch (err) {
    console.error('Error updating manager registration password:', err);
    res.status(500).json({ message: 'Server error updating manager registration password' });
  }
});

// ---------------- REGISTRATION HEATS ----------------
router.get('/admin/registration-heats', adminOnly, async (req, res) => {
  try {
    const heats = await RegistrationHeat.find().sort({ order: 1, date: 1, name: 1 });
    res.json(heats);
  } catch (err) {
    console.error('Error fetching registration heats:', err);
    res.status(500).json({ message: 'Server error fetching registration heats' });
  }
});

router.post('/admin/registration-heats', adminOnly, async (req, res) => {
  try {
    const { name, location, date, active, order } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Heat name is required' });
    }

    const heat = new RegistrationHeat({
      name: name.trim(),
      location: location ? String(location).trim() : '',
      date: date ? new Date(date) : null,
      active: active !== false,
      order: Number(order) || 0
    });
    await heat.save();
    res.status(201).json(heat);
  } catch (err) {
    console.error('Error creating registration heat:', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Heat already exists' });
    }
    res.status(500).json({ message: 'Server error creating registration heat' });
  }
});

router.put('/admin/registration-heats/:id', adminOnly, async (req, res) => {
  try {
    const { name, location, date, active, order } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Heat name is required' });
    }

    const updated = await RegistrationHeat.findByIdAndUpdate(
      req.params.id,
      {
        name: name.trim(),
        location: location ? String(location).trim() : '',
        date: date ? new Date(date) : null,
        active: active !== false,
        order: Number(order) || 0
      },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ message: 'Heat not found' });
    res.json(updated);
  } catch (err) {
    console.error('Error updating registration heat:', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Heat already exists' });
    }
    res.status(500).json({ message: 'Server error updating registration heat' });
  }
});

router.delete('/admin/registration-heats/:id', adminOnly, async (req, res) => {
  try {
    const pendingCount = await CompetitorRegistration.countDocuments({ heatId: req.params.id, status: 'pending' });
    if (pendingCount > 0) {
      return res.status(409).json({ message: 'Cannot delete heat with pending registrations. Deactivate it instead.' });
    }
    await RegistrationHeat.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting registration heat:', err);
    res.status(500).json({ message: 'Server error deleting registration heat' });
  }
});

// ---------------- REGIONS ----------------
router.get('/admin/regions', adminOnly, async (req, res) => {
  try {
    const regions = await Region.find().sort({ order: 1, name: 1 });
    res.json(regions);
  } catch (err) {
    console.error('Error fetching regions:', err);
    res.status(500).json({ message: 'Server error fetching regions' });
  }
});

router.post('/admin/regions', adminOnly, async (req, res) => {
  try {
    const { name, active, order } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Region name is required' });
    }

    const region = new Region({
      name: name.trim(),
      active: active !== false,
      order: Number(order) || 0
    });
    await region.save();
    res.status(201).json(region);
  } catch (err) {
    console.error('Error creating region:', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Region already exists' });
    }
    res.status(500).json({ message: 'Server error creating region' });
  }
});

router.put('/admin/regions/:id', adminOnly, async (req, res) => {
  try {
    const { name, active, order } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Region name is required' });
    }

    const updated = await Region.findByIdAndUpdate(
      req.params.id,
      { name: name.trim(), active: active !== false, order: Number(order) || 0 },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ message: 'Region not found' });

    await Club.updateMany(
      { regionId: updated._id },
      { regionNameSnapshot: updated.name }
    );

    res.json(updated);
  } catch (err) {
    console.error('Error updating region:', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Region already exists' });
    }
    res.status(500).json({ message: 'Server error updating region' });
  }
});

router.delete('/admin/regions/:id', adminOnly, async (req, res) => {
  try {
    const clubCount = await Club.countDocuments({ regionId: req.params.id });
    if (clubCount > 0) {
      return res.status(409).json({ message: 'Cannot delete region while clubs are assigned to it. Disable it or move clubs first.' });
    }

    await Region.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting region:', err);
    res.status(500).json({ message: 'Server error deleting region' });
  }
});

// ---------------- CLUBS ----------------
router.get('/admin/clubs', adminOnly, async (req, res) => {
  try {
    const clubs = await Club.find().sort({ regionNameSnapshot: 1, name: 1 });
    res.json(clubs);
  } catch (err) {
    console.error('Error fetching clubs:', err);
    res.status(500).json({ message: 'Server error fetching clubs' });
  }
});

router.post('/admin/clubs', adminOnly, async (req, res) => {
  try {
    const { name, active, regionId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Club name is required' });
    }

    const regionData = await resolveRegion(regionId);
    const club = new Club({ name: name.trim(), active: active !== false, ...regionData });
    await club.save();
    res.status(201).json(club);
  } catch (err) {
    console.error('Error creating club:', err);
    if (err.status) return res.status(err.status).json({ message: err.message });
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Club already exists' });
    }
    res.status(500).json({ message: 'Server error creating club' });
  }
});

router.put('/admin/clubs/:id', adminOnly, async (req, res) => {
  try {
    const { name, active, regionId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Club name is required' });
    }

    const regionData = await resolveRegion(regionId);
    const updated = await Club.findByIdAndUpdate(
      req.params.id,
      { name: name.trim(), active: active !== false, ...regionData },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ message: 'Club not found' });
    res.json(updated);
  } catch (err) {
    console.error('Error updating club:', err);
    if (err.status) return res.status(err.status).json({ message: err.message });
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Club already exists' });
    }
    res.status(500).json({ message: 'Server error updating club' });
  }
});

router.delete('/admin/clubs/:id', adminOnly, async (req, res) => {
  try {
    const pendingCount = await CompetitorRegistration.countDocuments({ clubId: req.params.id, status: 'pending' });
    if (pendingCount > 0) {
      return res.status(409).json({ message: 'Cannot delete club with pending registrations. Deactivate it instead.' });
    }

    await Club.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting club:', err);
    res.status(500).json({ message: 'Server error deleting club' });
  }
});

// ---------------- REGISTRATION TIMING CATEGORIES ----------------
router.get('/admin/registration-timing-categories', adminOnly, async (req, res) => {
  try {
    const categories = await RegistrationTimingCategory.find().sort({ order: 1, name: 1 });
    res.json(categories);
  } catch (err) {
    console.error('Error fetching registration timing categories:', err);
    res.status(500).json({ message: 'Server error fetching registration timing categories' });
  }
});

router.post('/admin/registration-timing-categories', adminOnly, async (req, res) => {
  try {
    const { name, active, order } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Timing category name is required' });
    }

    const category = new RegistrationTimingCategory({
      name: name.trim(),
      active: active !== false,
      order: Number(order) || 0
    });
    await category.save();
    res.status(201).json(category);
  } catch (err) {
    console.error('Error creating registration timing category:', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Timing category already exists' });
    }
    res.status(500).json({ message: 'Server error creating registration timing category' });
  }
});

router.put('/admin/registration-timing-categories/:id', adminOnly, async (req, res) => {
  try {
    const { name, active, order } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Timing category name is required' });
    }

    const updated = await RegistrationTimingCategory.findByIdAndUpdate(
      req.params.id,
      { name: name.trim(), active: active !== false, order: Number(order) || 0 },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ message: 'Timing category not found' });
    res.json(updated);
  } catch (err) {
    console.error('Error updating registration timing category:', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Timing category already exists' });
    }
    res.status(500).json({ message: 'Server error updating registration timing category' });
  }
});

router.delete('/admin/registration-timing-categories/:id', adminOnly, async (req, res) => {
  try {
    await RegistrationTimingCategory.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting registration timing category:', err);
    res.status(500).json({ message: 'Server error deleting registration timing category' });
  }
});

// ---------------- REGISTRATIONS ----------------
router.get('/admin/registrations', adminOnly, async (req, res) => {
  try {
    const { status, regionId, heatId } = req.query;
    const query = status && status !== 'all' ? { status } : {};

    if (regionId && regionId !== 'all') {
      if (regionId === 'ungrouped') {
        query.$or = [
          { regionId: null },
          { regionId: { $exists: false } },
          { regionNameSnapshot: '' },
          { regionNameSnapshot: { $exists: false } }
        ];
      } else {
        query.regionId = regionId;
      }
    }



    if (heatId && heatId !== 'all') {
      if (heatId === 'unassigned') {
        query.$or = [
          ...(query.$or || []),
          { heatId: null },
          { heatId: { $exists: false } },
          { heatNameSnapshot: '' },
          { heatNameSnapshot: { $exists: false } }
        ];
      } else {
        query.heatId = heatId;
      }
    }

    const registrations = await CompetitorRegistration.find(query).sort({ createdAt: -1 });
    res.json(registrations);
  } catch (err) {
    console.error('Error fetching registrations:', err);
    res.status(500).json({ message: 'Server error fetching registrations' });
  }
});

router.post('/admin/registrations/:id/accept', adminOnly, async (req, res) => {
  try {
    const registration = await CompetitorRegistration.findById(req.params.id);
    if (!registration) return res.status(404).json({ message: 'Registration not found' });

    if (registration.status === 'accepted' && registration.acceptedCompetitorId) {
      return res.status(409).json({ message: 'Registration already accepted' });
    }

    if (registration.status === 'rejected') {
      return res.status(409).json({ message: 'Rejected registration cannot be accepted' });
    }

    const competitor = new Competitor({
      name: registration.name.trim(),
      category: registration.competitionCategory,
      location: registration.clubNameSnapshot
    });
    await competitor.save();

    registration.status = 'accepted';
    registration.acceptedCompetitorId = competitor._id;
    registration.reviewedAt = new Date();
    registration.reviewedBy = req.user?.username || '';
    registration.rejectionReason = '';
    await registration.save();

    res.json({ success: true, registration, competitor });
  } catch (err) {
    console.error('Error accepting registration:', err);
    res.status(500).json({ message: 'Server error accepting registration' });
  }
});

router.post('/admin/registrations/:id/reject', adminOnly, async (req, res) => {
  try {
    const registration = await CompetitorRegistration.findById(req.params.id);
    if (!registration) return res.status(404).json({ message: 'Registration not found' });

    if (registration.status === 'accepted') {
      return res.status(409).json({ message: 'Accepted registration cannot be rejected' });
    }

    registration.status = 'rejected';
    registration.rejectionReason = req.body?.reason ? String(req.body.reason).trim() : '';
    registration.reviewedAt = new Date();
    registration.reviewedBy = req.user?.username || '';
    await registration.save();

    res.json({ success: true, registration });
  } catch (err) {
    console.error('Error rejecting registration:', err);
    res.status(500).json({ message: 'Server error rejecting registration' });
  }
});

module.exports = router;
