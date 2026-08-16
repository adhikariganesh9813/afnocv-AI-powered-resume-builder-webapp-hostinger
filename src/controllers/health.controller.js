const healthService = require('../services/health.service');

function ping(req, res) {
  const result = healthService.getStatus();
  res.json(result);
}

module.exports = { ping };
