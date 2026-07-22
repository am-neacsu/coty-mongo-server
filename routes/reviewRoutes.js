const express = require('express');

const Review = require('../models/Review');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.post('/reviews', requireAuth, async (req, res) => {
  try {
    const { judgeId, competitorId, categoryId, type, value } = req.body;

    if (!judgeId || !competitorId || !categoryId || !type || value === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const review = await Review.findOneAndUpdate(
      { judgeId, competitorId, categoryId },
      { judgeId, competitorId, categoryId, type, value },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ message: 'Review saved', review });
  } catch (err) {
    console.error('Review save error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/reviews/:judgeId/:competitorId', async (req, res) => {
  try {
    const { judgeId, competitorId } = req.params;
    const reviews = await Review.find({ judgeId, competitorId });
    res.json(reviews);
  } catch (err) {
    console.error('Error fetching existing reviews:', err);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

router.get('/reviews', async (req, res) => {
  try {
    const reviews = await Review.find();
    res.json(reviews);
  } catch (err) {
    console.error('Error fetching all reviews:', err);
    res.status(500).json({ error: 'Failed to load all reviews' });
  }
});

router.delete('/reviews', requireAuth, requireAdmin, async (req, res) => {
  try {
    await Review.deleteMany({});
    res.status(200).json({ message: 'All reviews deleted' });
  } catch (err) {
    console.error('Error deleting all reviews:', err);
    res.status(500).json({ error: 'Failed to delete reviews' });
  }
});

module.exports = router;
