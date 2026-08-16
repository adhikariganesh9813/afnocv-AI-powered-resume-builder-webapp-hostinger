const express = require('express');
const path = require('path');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);

// Central error handler: any next(err) from a controller lands here, so
// controllers never have to format error responses themselves.
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 ? 'Something went wrong. Please try again.' : err.message,
  });
});

module.exports = app;
