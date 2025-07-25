// server/routes/api.js
const express = require('express');
const router = express.Router();

const Competitor = require('../models/Competitor');
const Judge = require('../models/Judge');
const Category = require('../models/Category');
const Assignment = require('../models/Assignment');

// ---------------- LOGIN ----------------
router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const judge = await Judge.findOne({ username });
    if (!judge || judge.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    res.json({ success: true, isAdmin: judge.isAdmin, judgeId: judge._id });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------- COMPETITORS ----------------
router.get('/competitors', async (req, res) => {
  const list = await Competitor.find();
  res.json(list);
});

router.post('/competitors', async (req, res) => {
  const { name, category, location } = req.body;
  const competitor = new Competitor({
    name,
    category,
    location
  });
  await competitor.save();
  res.json(competitor);
});


router.delete('/competitors/:id', async (req, res) => {
  await Competitor.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

router.get('/competitors/:id', async (req, res) => {
  const comp = await Competitor.findById(req.params.id);
  res.json(comp);
});


// ---------------- JUDGES ----------------
router.get('/judges', async (req, res) => {
  const list = await Judge.find();
  res.json(list);
});

router.post('/judges', async (req, res) => {
  const judge = new Judge(req.body);
  await judge.save();
  res.json(judge);
});

router.delete('/judges/:id', async (req, res) => {
  await Judge.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});
// Judge login
router.post('/judges/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const judge = await Judge.findOne({ username });

    if (!judge) {
      return res.status(401).json({ error: 'Judge not found' });
    }

    // If you're not storing passwords securely, just match raw value
    if (judge.password !== password) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    res.json({ _id: judge._id, username: judge.username ,});
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});


// ---------------- CATEGORIES ----------------
router.get('/categories', async (req, res) => {
  const list = await Category.find();
  res.json(list);
});

router.post('/categories', async (req, res) => {
  const category = new Category(req.body); // includes name, type, required
  await category.save();
  res.json(category);
});

router.put('/categories/:id', async (req, res) => {
  const updated = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
});


router.delete('/categories/:id', async (req, res) => {
  await Category.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// ---------------- ASSIGNMENTS ----------------
router.post('/assignments', async (req, res) => {
  const { judgeId, competitorIds } = req.body;

  if (!judgeId) return res.status(400).json({ message: 'judgeId required' });

  try {
    const existing = await Assignment.findOne({ judgeId });

    if (existing) {
      existing.competitorIds = competitorIds;
      await existing.save();
      return res.json(existing);
    } else {
      const assignment = new Assignment({ judgeId, competitorIds });
      await assignment.save();
      return res.json(assignment);
    }
  } catch (err) {
    console.error('Assignment save error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
// Get all assignments
router.get('/assignments', async (req, res) => {
  try {
    const data = await Assignment.find({});
    res.json(data);
  } catch (err) {
    console.error('Error fetching assignments:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------- SAVE ALL ASSIGNMENTS ----------------
// Save all assignments (overwrite)
router.post('/assignments/save', async (req, res) => {
  try {
    const payload = req.body; // [{ judgeId, competitorId }, ...]

    if (!Array.isArray(payload)) {
      return res.status(400).json({ message: 'Invalid payload format' });
    }

    // Remove all previous assignments
    await Assignment.deleteMany({});

    // Insert new ones
    await Assignment.insertMany(payload);

    res.status(200).json({ message: 'All assignments saved' });
  } catch (err) {
    console.error('Error saving assignments:', err);
    res.status(500).json({ message: 'Failed to save assignments' });
  }
});

// Get assignments for a specific judge
router.get('/assignments/:judgeId', async (req, res) => {
  try {
    const assignment = await Assignment.findOne({ judgeId: req.params.judgeId });
    if (!assignment) {
      return res.status(404).json({ message: 'No assignments found for this judge' });
    }

    const competitors = await Competitor.find({ _id: { $in: assignment.competitorIds } });
    res.json({ assignment, competitors });

  } catch (err) {
    console.error('Error fetching judge assignments:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
// Get assignments by judge ID using new descriptive route
router.get('/assignments/judge/:judgeId', async (req, res) => {
  const { judgeId } = req.params;
  console.log(`Fetching assignments for judge ID: ${judgeId}`);

  try {
    const assignments = await Assignment.find({ judgeId }).populate('competitorId');
    console.log('Assignments found:', assignments);
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Server error' });
  }
});
// ---------------- REVIEWS ----------------
const Review = require('../models/Review');

router.post('/reviews', async (req, res) => {
  try {
    const { judgeId, competitorId, categoryId, type, value } = req.body;

    if (!judgeId || !competitorId || !categoryId || !type || value === undefined) {
      console.log('Missing field:', { judgeId, competitorId, categoryId, type, value });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = await Review.findOne({ judgeId, competitorId, categoryId });

    if (existing) {
      existing.type = type;
      existing.value = value;
      await existing.save();
      console.log('Updated existing review:', existing);
      return res.status(200).json({ message: 'Review updated', review: existing });
    }

    const review = new Review({ judgeId, competitorId, categoryId, type, value });
    await review.save();
    console.log('Created new review:', review);
    res.status(201).json({ message: 'Review created', review });
  } catch (err) {
    console.error('Review save error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



// GET reviews for a specific judge and competitor
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

// GET all reviews
router.get('/reviews', async (req, res) => {
  try {
    const reviews = await Review.find();
    res.json(reviews);
  } catch (err) {
    console.error('Error fetching all reviews:', err);
    res.status(500).json({ error: 'Failed to load all reviews' });
  }
});

router.delete('/reviews', async (req, res) => {
  try {
    await Review.deleteMany({});
    res.status(200).json({ message: 'All reviews deleted' });
  } catch (err) {
    console.error('Error deleting all reviews:', err);
    res.status(500).json({ error: 'Failed to delete reviews' });
  }
});


module.exports = router;
