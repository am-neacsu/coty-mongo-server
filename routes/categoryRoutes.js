const express = require('express');

const Category = require('../models/Category');
const Review = require('../models/Review');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

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

module.exports = router;
