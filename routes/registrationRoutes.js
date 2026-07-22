const express = require('express');

const Club = require('../models/Club');
const RegistrationTimingCategory = require('../models/RegistrationTimingCategory');
const CompetitorRegistration = require('../models/CompetitorRegistration');

const router = express.Router();

const COMPETITION_CATEGORIES = ['Under 2 years', 'Over 2 years'];

router.get('/registration/public-config', async (req, res) => {
  try {
    const [clubs, timingCategories] = await Promise.all([
      Club.find({ active: true }).sort({ name: 1 }),
      RegistrationTimingCategory.find({ active: true }).sort({ order: 1, name: 1 })
    ]);

    res.json({
      clubs,
      timingCategories,
      competitionCategories: COMPETITION_CATEGORIES
    });
  } catch (err) {
    console.error('Error fetching registration config:', err);
    res.status(500).json({ message: 'Server error fetching registration config' });
  }
});

router.post('/registration', async (req, res) => {
  try {
    const { name, surname, clubId, competitionCategory, timings } = req.body;

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
    const timingCategoryMap = new Map(timingCategories.map(cat => [String(cat._id), cat]));

    const cleanTimings = Array.isArray(timings)
      ? timings
          .filter(t => t && t.categoryId && timingCategoryMap.has(String(t.categoryId)))
          .map(t => {
            const cat = timingCategoryMap.get(String(t.categoryId));
            return {
              categoryId: cat._id,
              categoryNameSnapshot: cat.name,
              value: String(t.value || '').trim()
            };
          })
      : [];

    const registration = new CompetitorRegistration({
      name: name.trim(),
      surname: surname ? surname.trim() : '',
      clubId: club._id,
      clubNameSnapshot: club.name,
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
