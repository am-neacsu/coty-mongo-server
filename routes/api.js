const express = require('express');
const mongoose = require('mongoose');

const authRoutes = require('./authRoutes').router;
const competitorRoutes = require('./competitorRoutes');
const judgeRoutes = require('./judgeRoutes');
const categoryRoutes = require('./categoryRoutes');
const assignmentRoutes = require('./assignmentRoutes');
const reviewRoutes = require('./reviewRoutes');
const registrationRoutes = require('./registrationRoutes');
const adminRegistrationRoutes = require('./adminRegistrationRoutes');

const router = express.Router();

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

router.use(authRoutes);
router.use(competitorRoutes);
router.use(judgeRoutes);
router.use(categoryRoutes);
router.use(assignmentRoutes);
router.use(reviewRoutes);
router.use(registrationRoutes);
router.use(adminRegistrationRoutes);

module.exports = router;
