const express = require('express');
const bcrypt = require('bcrypt');

const Judge = require('../models/Judge');
const Assignment = require('../models/Assignment');
const Review = require('../models/Review');
const Category = require('../models/Category');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { passwordMatches, sanitizeJudge } = require('./authRoutes');

const router = express.Router();
const SALT_ROUNDS = 10;

router.get('/judges', async (req, res) => {
  try {
    // Never send stored password hashes/plain-text passwords to the frontend.
    const list = await Judge.find().select('-password').sort({ username: 1 });
    res.json(list);
  } catch (err) {
    console.error('Error fetching judges:', err);
    res.status(500).json({ message: 'Server error fetching judges' });
  }
});

router.post('/judges', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username, password, location, table, isAdmin } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ message: 'Username is required' });
    }

    if (!password || !password.trim()) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const judge = new Judge({
      username: username.trim(),
      password: await bcrypt.hash(password, SALT_ROUNDS),
      location: location || '',
      table: table || '',
      isAdmin: !!isAdmin
    });

    await judge.save();
    res.status(201).json(sanitizeJudge(judge));
  } catch (err) {
    console.error('Error creating judge:', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A judge with this username already exists' });
    }
    res.status(500).json({ message: 'Server error creating judge' });
  }
});

router.put('/judges/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username, password, location, table, isAdmin } = req.body;
    const update = {};

    if (username && username.trim()) update.username = username.trim();
    if (password && password.trim()) update.password = await bcrypt.hash(password, SALT_ROUNDS);
    if (location !== undefined) update.location = location;
    if (table !== undefined) update.table = table;
    if (isAdmin !== undefined) update.isAdmin = isAdmin;

    const judge = await Judge.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true
    }).select('-password');

    if (!judge) return res.status(404).json({ message: 'Judge not found' });
    res.json(judge);
  } catch (err) {
    console.error('Error updating judge:', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A judge with this username already exists' });
    }
    res.status(500).json({ message: 'Update failed' });
  }
});

router.delete('/judges/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const judge = await Judge.findById(id).select('username isAdmin');

    if (!judge) {
      return res.status(404).json({ message: 'Judge not found' });
    }

    if (judge.isAdmin || String(judge.username || '').toLowerCase() === 'admin') {
      return res.status(400).json({ message: 'Admin account cannot be deleted' });
    }

    await Assignment.deleteMany({ judgeId: id });
    await Review.deleteMany({ judgeId: id });
    await Category.updateMany({}, { $pull: { visibleToJudges: id } });
    await Judge.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting judge:', err);
    res.status(500).json({ message: 'Server error deleting judge' });
  }
});

// Backward-compatible judge login route. Prefer /auth/login.
router.post('/judges/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const judge = await Judge.findOne({ username });
    const ok = judge ? await passwordMatches(password, judge.password) : false;

    if (!judge || !ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({ _id: judge._id, username: judge.username, isAdmin: judge.isAdmin });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

module.exports = router;
