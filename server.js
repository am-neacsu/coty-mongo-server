// server/server.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const app = require('./app');

// Load .env variables
dotenv.config();
console.log(`[${new Date().toISOString()}] .env loaded - MONGO_URI=${process.env.MONGO_URI ? 'present' : 'missing'}`);
console.log(`[${new Date().toISOString()}] Middleware configured`);

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log(`[${new Date().toISOString()}] MongoDB connected`);
}).catch(err => {
  console.error(`[${new Date().toISOString()}] MongoDB connection error:`, err);
});

console.log(`[${new Date().toISOString()}] API routes mounted at /api`);

// Server start
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server running on port ${PORT}`);
});
