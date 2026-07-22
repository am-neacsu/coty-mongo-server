// server/routes/api.js
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

const Competitor = require('../models/Competitor');
const Judge = require('../models/Judge');
const Category = require('../models/Category');
const Assignment = require('../models/Assignment');
const Review = require('../models/Review');

const SALT_ROUNDS = 10;

function isBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$/.test(value);
}

async function passwordMatches(plainPassword, storedPassword) {
  if (!plainPassword || !storedPassword) return false;
  if (isBcryptHash(storedPassword)) {
    return bcrypt.compare(plainPassword, storedPassword);
  }
  // Temporary compatibility for existing plain-text passwords.
  return plainPassword === storedPassword;
}

function sanitizeJudge(judge) {
  if (!judge) return judge;
  const obj = judge.toObject ? judge.toObject() : { ...judge };
  delete obj.password;
  return obj;
}

function signToken(judge) {
  const secret = process.env.JWT_SECRET || 'local-dev-secret-change-me';
  return jwt.sign(
    {
      id: judge._id.toString(),
      username: judge.username,
      isAdmin: !!judge.isAdmin
    },
    secret,
    { expiresIn: '12h' }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'local-dev-secret-change-me';
    req.user = jwt.verify(token, secret);
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

// ---------------- HEALTH ----------------
router.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';

  res.json({
    status: 'ok',
    service: 'coty-api',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// ---------------- LOGIN ----------------
router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const judge = await Judge.findOne({ username });
    const ok = judge ? await passwordMatches(password, judge.password) : false;

    if (!judge || !ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({
      success: true,
      token: signToken(judge),
      isAdmin: judge.isAdmin,
      judgeId: judge._id,
      user: sanitizeJudge(judge)
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------- COMPETITORS ----------------
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

// ---------------- JUDGES ----------------
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

// ---------------- CATEGORIES ----------------
router.get('/categories', async (req, res) => {
  try {
    const list = await Category.find().sort({ name: 1 });
    res.json(list);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ message: 'Server error fetching categories' });
  }
});

router.get('/categories/judge/:judgeId', async (req, res) => {
  try {
    const { judgeId } = req.params;

    const categories = await Category.find({
      $or: [
        { visibleToJudges: { $exists: false } },
        { visibleToJudges: { $size: 0 } },
        { visibleToJudges: judgeId },
      ],
    }).sort({ name: 1 });

    res.json(categories);
  } catch (err) {
    console.error('Error fetching judge-specific categories:', err);
    res.status(500).json({ message: 'Server error fetching judge categories' });
  }
});

router.post('/categories', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, type, mandatory, visibleToJudges } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const category = new Category({
      name: name.trim(),
      type,
      mandatory,
      visibleToJudges
    });

    await category.save();
    res.status(201).json(category);
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ message: 'Server error creating category' });
  }
});

router.put('/categories/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const updated = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!updated) return res.status(404).json({ message: 'Category not found' });
    res.json(updated);
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(500).json({ message: 'Server error updating category' });
  }
});

router.delete('/categories/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await Review.deleteMany({ categoryId: id });
    await Category.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ message: 'Server error deleting category' });
  }
});

// ---------------- ASSIGNMENTS ----------------
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

// ---------------- REVIEWS ----------------
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
