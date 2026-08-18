const { execSync } = require('child_process');

// Which commit this process is running. Read once at startup, because that is
// exactly the point: a running Node process keeps the code it loaded, so a
// server started before a `git pull` still serves the old behaviour. Comparing
// this against the latest commit tells you whether a deploy actually took.
const COMMIT = (() => {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: `${__dirname}/../..`,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch (err) {
    // Not a git checkout (or git unavailable) — not worth failing a health check over.
    return 'unknown';
  }
})();

const STARTED_AT = new Date().toISOString();

function getStatus() {
  return {
    status: 'ok',
    message: 'pong',
    commit: COMMIT,
    startedAt: STARTED_AT,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { getStatus };
