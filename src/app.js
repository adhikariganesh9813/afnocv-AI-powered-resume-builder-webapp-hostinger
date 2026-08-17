const express = require('express');
const path = require('path');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const generationRoutes = require('./routes/generation.routes');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/generate', generationRoutes);

// Central error handler: any next(err) from a controller lands here, so
// controllers never have to format error responses themselves.
//
// Messages are only shown to the client for errors we wrote deliberately —
// client errors (4xx), or ones flagged `expose` because the text is useful and
// leaks nothing (e.g. "the AI provider is not configured yet"). Anything else
// is an unexpected failure, so it is logged and reported generically.
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const safeToShow = status < 500 || err.expose === true;

  if (status >= 500) console.error(err);

  res.status(status).json({
    error: safeToShow ? err.message : 'Something went wrong. Please try again.',
  });
});

module.exports = app;
