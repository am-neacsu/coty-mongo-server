// server/createAdmin.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const Judge = require('./models/Judge'); // adjust path if needed

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const existing = await Judge.findOne({ username: 'admin' });

    if (existing) {
      console.log('Admin user already exists.');
      process.exit();
    }

    const hashedPassword = await bcrypt.hash('admin', 10);
    const admin = new Judge({
      username: 'admin',
      password: hashedPassword,
      isAdmin: true
    });

    await admin.save();
    console.log('Default admin user created.');
    process.exit();
  } catch (err) {
    console.error('Error creating admin user:', err);
    process.exit(1);
  }
};

createAdmin();
