// server/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load .env variables
dotenv.config();
console.log(`[${new Date().toISOString()}] .env loaded - MONGO_URI=${process.env.MONGO_URI ? 'present' : 'missing'}`);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
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

// Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);
console.log(`[${new Date().toISOString()}] API routes mounted at /api`);

// Default route
app.get('/', (req, res) => {
  console.log(`[${new Date().toISOString()}] GET / hit`);
  res.send('Competition Review API is running.');
});

// Server start
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server running on port ${PORT}`);
});
