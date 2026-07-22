const express = require('express');

const Competitor = require('../models/Competitor');
const Assignment = require('../models/Assignment');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.post('/assignments', requireAuth, requireAdmin, async (req, res) => {
  const { judgeId, competitorIds } = req.body;

  if (!judgeId) return res.status(400).json({ message: 'judgeId required' });

  try {
    await Assignment.deleteMany({ judgeId });

    if (Array.isArray(competitorIds) && competitorIds.length > 0) {
      const assignments = competitorIds.map(cId => ({ judgeId, competitorId: cId }));
      const inserted = await Assignment.insertMany(assignments, { ordered: false });
      return res.json({ message: 'Assignments updated', count: inserted.length });
    }

    return res.json({ message: 'Assignments cleared' });
  } catch (err) {
    console.error('Assignment save error:', err);
    res.status(500).json({ message: 'Server error saving assignments' });
  }
});

router.get('/assignments', async (req, res) => {
  try {
    const data = await Assignment.find({});
    res.json(data);
  } catch (err) {
    console.error('Error fetching assignments:', err);
    res.status(500).json({ message: 'Server error fetching assignments' });
  }
});

router.post('/assignments/save', requireAuth, requireAdmin, async (req, res) => {
  try {
    const payload = req.body;

    if (!Array.isArray(payload)) {
      return res.status(400).json({ message: 'Invalid payload format' });
    }

    await Assignment.deleteMany({});

    if (payload.length > 0) {
      await Assignment.insertMany(payload, { ordered: false });
    }

    res.status(200).json({ message: 'All assignments saved' });
  } catch (err) {
    console.error('Error saving assignments:', err);
    res.status(500).json({ message: 'Failed to save assignments' });
  }
});

router.get('/assignments/:judgeId', async (req, res) => {
  try {
    const { judgeId } = req.params;
    const assignments = await Assignment.find({ judgeId });

    if (!assignments || assignments.length === 0) {
      return res.json({ assignment: null, competitors: [] });
    }

    const competitorIds = assignments.map(a => a.competitorId);
    const competitors = await Competitor.find({ _id: { $in: competitorIds } });

    res.json({
      assignment: { judgeId, competitorIds },
      competitors
    });
  } catch (err) {
    console.error('Error fetching judge assignments:', err);
    res.status(500).json({ message: 'Server error fetching judge assignments' });
  }
});

router.get('/assignments/judge/:judgeId', async (req, res) => {
  const { judgeId } = req.params;

  try {
    const assignments = await Assignment.find({ judgeId }).populate('competitorId');
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
