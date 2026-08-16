const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

const SALT_ROUNDS = 10;

function signToken(user) {
  return jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

async function signup(email, password) {
  const normalizedEmail = String(email).trim().toLowerCase();

  const existing = await query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
  if (existing.length > 0) {
    const err = new Error('An account with that email already exists.');
    err.status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const result = await query('INSERT INTO users (email, password_hash) VALUES (?, ?)', [
    normalizedEmail,
    passwordHash,
  ]);

  const user = { id: result.insertId, email: normalizedEmail };

  // Every user gets exactly one profile row (1:1), created up front so the
  // profile page always has a row to update rather than special-casing "first save".
  await query('INSERT INTO profiles (user_id) VALUES (?)', [user.id]);

  return { token: signToken(user), user };
}

async function login(email, password) {
  const normalizedEmail = String(email).trim().toLowerCase();

  const rows = await query('SELECT id, email, password_hash FROM users WHERE email = ?', [
    normalizedEmail,
  ]);

  // Same generic message whether the email is unknown or the password is wrong,
  // so the response can't be used to discover which emails have accounts.
  const invalid = new Error('Incorrect email or password.');
  invalid.status = 401;

  if (rows.length === 0) throw invalid;

  const matches = await bcrypt.compare(password, rows[0].password_hash);
  if (!matches) throw invalid;

  const user = { id: rows[0].id, email: rows[0].email };
  return { token: signToken(user), user };
}

module.exports = { signup, login };
