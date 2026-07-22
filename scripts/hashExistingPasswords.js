const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const Judge = require('../models/Judge');

dotenv.config();

const SALT_ROUNDS = 10;

function isBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$/.test(value);
}

async function run() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is missing from .env');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const judges = await Judge.find();
    let updated = 0;
    let skipped = 0;

    for (const judge of judges) {
      if (!judge.password) {
        console.warn(`Skipping ${judge.username}: password is empty/missing`);
        skipped += 1;
        continue;
      }

      if (isBcryptHash(judge.password)) {
        skipped += 1;
        continue;
      }

      judge.password = await bcrypt.hash(judge.password, SALT_ROUNDS);
      await judge.save();
      updated += 1;
      console.log(`Hashed password for ${judge.username}`);
    }

    console.log(`Done. Updated: ${updated}. Already hashed/skipped: ${skipped}.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Password migration failed:', err);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
}

run();
