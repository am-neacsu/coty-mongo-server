const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const Club = require('../models/Club');
const RegistrationHeat = require('../models/RegistrationHeat');
const RegistrationSettings = require('../models/RegistrationSettings');
const RegistrationTimingCategory = require('../models/RegistrationTimingCategory');
const CompetitorRegistration = require('../models/CompetitorRegistration');

const router = express.Router();

const COMPETITION_CATEGORIES = ['Under 2 years', 'Over 2 years'];
const REGISTRATION_ACCESS_TTL = '12h';

function getRegistrationSecret() {
  return process.env.REGISTRATION_ACCESS_SECRET || process.env.JWT_SECRET || 'local-registration-secret-change-me';
}

async function getRegistrationSettings() {
  let settings = await RegistrationSettings.findOne();
  if (!settings) {
    settings = await RegistrationSettings.create({ registrationOpen: true });
  }
  return settings;
}

function signRegistrationAccessToken(heat) {
  return jwt.sign(
    {
      type: 'manager-registration',
      heatId: heat._id.toString(),
      heatName: heat.name
    },
    getRegistrationSecret(),
    { expiresIn: REGISTRATION_ACCESS_TTL }
  );
}

async function requireRegistrationAccess(req, res, next) {
  const token = req.headers['x-registration-access'];
  if (!token) {
    return res.status(401).json({ message: 'Manager registration access is required' });
  }

  try {
    const payload = jwt.verify(String(token), getRegistrationSecret());
    if (payload.type !== 'manager-registration' || !payload.heatId) {
      return res.status(401).json({ message: 'Invalid registration access' });
    }

    const [settings, heat] = await Promise.all([
      getRegistrationSettings(),
      RegistrationHeat.findOne({ _id: payload.heatId, active: true })
    ]);

    if (!settings.registrationOpen) {
      return res.status(403).json({ message: 'Registration is currently closed' });
    }

    if (!heat) {
      return res.status(401).json({ message: 'Selected heat is no longer available' });
    }

    req.registrationHeat = heat;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired registration access' });
  }
}

router.get('/registration/access-config', async (req, res) => {
  try {
    const [settings, heats] = await Promise.all([
      getRegistrationSettings(),
      RegistrationHeat.find({ active: true }).sort({ order: 1, date: 1, name: 1 })
    ]);

    res.json({
      registrationOpen: settings.registrationOpen,
      passwordRequired: !!settings.managerPasswordHash,
      heats
    });
  } catch (err) {
    console.error('Error fetching registration access config:', err);
    res.status(500).json({ message: 'Server error fetching registration access config' });
  }
});

router.post('/registration/access', async (req, res) => {
  try {
    const { heatId, password } = req.body;

    if (!heatId) {
      return res.status(400).json({ message: 'Please select a heat' });
    }

    if (!password) {
      return res.status(400).json({ message: 'Registration password is required' });
    }

    const [settings, heat] = await Promise.all([
      getRegistrationSettings(),
      RegistrationHeat.findOne({ _id: heatId, active: true })
    ]);

    if (!settings.registrationOpen) {
      return res.status(403).json({ message: 'Registration is currently closed' });
    }

    if (!settings.managerPasswordHash) {
      return res.status(403).json({ message: 'Manager registration password has not been configured yet' });
    }

    if (!heat) {
      return res.status(404).json({ message: 'Selected heat is not available' });
    }

    const passwordOk = await bcrypt.compare(String(password), settings.managerPasswordHash);
    if (!passwordOk) {
      return res.status(401).json({ message: 'Invalid registration password' });
    }

    const accessToken = signRegistrationAccessToken(heat);
    res.json({
      success: true,
      accessToken,
      heat: {
        _id: heat._id,
        name: heat.name,
        location: heat.location,
        date: heat.date,
        order: heat.order
      }
    });
  } catch (err) {
    console.error('Error verifying registration access:', err);
    res.status(500).json({ message: 'Server error verifying registration access' });
  }
});

router.get('/registration/public-config', requireRegistrationAccess, async (req, res) => {
  try {
    const [clubs, timingCategories] = await Promise.all([
      Club.find({ active: true }).sort({ name: 1 }),
      RegistrationTimingCategory.find({ active: true }).sort({ order: 1, name: 1 })
    ]);

    res.json({
      clubs,
      timingCategories,
      competitionCategories: COMPETITION_CATEGORIES,
      heat: {
        _id: req.registrationHeat._id,
        name: req.registrationHeat.name,
        location: req.registrationHeat.location,
        date: req.registrationHeat.date
      }
    });
  } catch (err) {
    console.error('Error fetching registration config:', err);
    res.status(500).json({ message: 'Server error fetching registration config' });
  }
});

router.post('/registration', requireRegistrationAccess, async (req, res) => {
  try {
    const { name, surname, clubId, competitionCategory, timings } = req.body;
    const heat = req.registrationHeat;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (!clubId) {
      return res.status(400).json({ message: 'Club is required' });
    }

    if (!COMPETITION_CATEGORIES.includes(competitionCategory)) {
      return res.status(400).json({ message: 'Invalid competition category' });
    }

    const club = await Club.findOne({ _id: clubId, active: true });
    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const timingCategories = await RegistrationTimingCategory.find({ active: true });
    const submittedTimingMap = new Map(
      Array.isArray(timings)
        ? timings.map(t => [String(t?.categoryId || ''), String(t?.value || '').trim()])
        : []
    );

    const missingTiming = timingCategories.find(cat => !submittedTimingMap.get(String(cat._id)));
    if (missingTiming) {
      return res.status(400).json({ message: `Timing information is required for ${missingTiming.name}` });
    }

    const cleanTimings = timingCategories.map(cat => ({
      categoryId: cat._id,
      categoryNameSnapshot: cat.name,
      value: submittedTimingMap.get(String(cat._id))
    }));

    const registration = new CompetitorRegistration({
      name: name.trim(),
      surname: surname ? surname.trim() : '',
      clubId: club._id,
      clubNameSnapshot: club.name,
      regionId: club.regionId || null,
      regionNameSnapshot: club.regionNameSnapshot || '',
      heatId: heat._id,
      heatNameSnapshot: heat.name,
      heatLocationSnapshot: heat.location || '',
      heatDateSnapshot: heat.date || null,
      competitionCategory,
      timings: cleanTimings
    });

    await registration.save();
    res.status(201).json({ success: true, registration });
  } catch (err) {
    console.error('Error creating competitor registration:', err);
    res.status(500).json({ message: 'Server error creating registration' });
  }
});

module.exports = router;
