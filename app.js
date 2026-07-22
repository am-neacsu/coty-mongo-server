// server/app.js
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Default route
app.get('/', (req, res) => {
  res.send('Competition Review API is running.');
});

module.exports = app;
