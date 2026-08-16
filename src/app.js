const express = require('express');
const path = require('path');
const healthRoutes = require('./routes/health.routes');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', healthRoutes);

module.exports = app;
