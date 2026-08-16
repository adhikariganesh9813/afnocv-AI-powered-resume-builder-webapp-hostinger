function getStatus() {
  return {
    status: 'ok',
    message: 'pong',
    timestamp: new Date().toISOString(),
  };
}

module.exports = { getStatus };
