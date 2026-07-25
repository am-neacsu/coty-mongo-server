const express = require('express');

const Competitor = require('../models/Competitor');
const Assignment = require('../models/Assignment');
const Review = require('../models/Review');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/competitors', async (req, res) => {
  try {
    const list = await Competitor.find().sort({ name: 1 });
    res.json(list);
  } catch (err) {
    console.error('Error fetching competitors:', err);
    res.status(500).json({ message: 'Server error fetching competitors' });
  }
});

router.post('/competitors', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, category, location } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Competitor name is required' });
    }

    const competitor = new Competitor({
      name: name.trim(),
      category,
      location: location || '',
    });

    await competitor.save();
    res.status(201).json(competitor);
  } catch (err) {
    console.error('Error creating competitor:', err);
    res.status(500).json({ message: 'Server error creating competitor' });
  }
});

router.put('/competitors/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, category, location } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Competitor name is required' });
    }

    const updated = await Competitor.findByIdAndUpdate(
      req.params.id,
      { name: name.trim(), category, location: location || '' },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ message: 'Competitor not found' });
    res.json(updated);
  } catch (err) {
    console.error('Error updating competitor:', err);
    res.status(500).json({ message: 'Server error updating competitor' });
  }
});

router.delete('/competitors/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Assignment.deleteMany({ competitorId: id });
    await Review.deleteMany({ competitorId: id });
    await Competitor.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting competitor:', err);
    res.status(500).json({ message: 'Server error deleting competitor' });
  }
});

router.get('/competitors/:id', async (req, res) => {
  try {
    const comp = await Competitor.findById(req.params.id);
    if (!comp) return res.status(404).json({ message: 'Competitor not found' });
    res.json(comp);
  } catch (err) {
    console.error('Error fetching competitor:', err);
    res.status(500).json({ message: 'Server error fetching competitor' });
  }
});

module.exports = router;
