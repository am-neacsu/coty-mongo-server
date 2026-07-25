const express = require('express');
const bcrypt = require('bcrypt');

const Judge = require('../models/Judge');
const { signToken } = require('../middleware/auth');

const router = express.Router();

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

module.exports = {
  router,
  passwordMatches,
  sanitizeJudge
};
