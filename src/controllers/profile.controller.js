const profileService = require('../services/profile.service');

async function getProfile(req, res, next) {
  try {
    const profile = await profileService.getProfile(req.user.userId);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

async function saveProfile(req, res, next) {
  try {
    const profile = await profileService.saveProfile(req.user.userId, req.body);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile, saveProfile };
