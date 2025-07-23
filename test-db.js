// test-db.js

require('dotenv').config();
const mongoose = require('mongoose');

console.log('[INFO] Attempting to connect to MongoDB...');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('[SUCCESS] Connected to MongoDB successfully.');
  mongoose.disconnect();
})
.catch(err => {
  console.error('[ERROR] Failed to connect to MongoDB:', err.message);
  process.exit(1);
});
// This script is used to test the MongoDB connection using the URI from .env