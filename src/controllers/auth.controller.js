const authService = require('../services/auth.service');

function validateCredentials(email, password) {
  if (!email || !password) {
    const err = new Error('Email and password are required.');
    err.status = 400;
    throw err;
  }
  if (String(password).length < 8) {
    const err = new Error('Password must be at least 8 characters.');
    err.status = 400;
    throw err;
  }
}

async function signup(req, res, next) {
  try {
    const { email, password } = req.body;
    validateCredentials(email, password);
    const result = await authService.signup(email, password);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      const err = new Error('Email and password are required.');
      err.status = 400;
      throw err;
    }
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

function me(req, res) {
  res.json({ user: { id: req.user.userId, email: req.user.email } });
}

module.exports = { signup, login, me };
