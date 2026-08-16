// Quick connection test: run `npm run db:check` after filling in .env.
// Confirms the credentials work and the expected tables exist.
require('dotenv').config({ quiet: true });

const { pool, query } = require('../src/config/db');

const EXPECTED_TABLES = [
  'users',
  'profiles',
  'skills',
  'education',
  'certifications',
  'coursework',
  'experience',
  'experience_bullets',
  'projects',
  'project_technologies',
  'project_bullets',
  'languages',
  'generations',
];

async function main() {
  console.log(`Connecting to ${process.env.DB_NAME} at ${process.env.DB_HOST}:${process.env.DB_PORT}...`);

  const rows = await query('SHOW TABLES', []);
  const found = rows.map((row) => Object.values(row)[0]);

  console.log('Connected.\n');

  const missing = EXPECTED_TABLES.filter((t) => !found.includes(t));

  EXPECTED_TABLES.forEach((table) => {
    console.log(`  ${found.includes(table) ? '[ok]     ' : '[MISSING]'} ${table}`);
  });

  if (missing.length > 0) {
    console.log(`\n${missing.length} table(s) missing. Run db/schema.sql against this database.`);
    process.exit(1);
  }

  const [{ count }] = await query('SELECT COUNT(*) AS count FROM users', []);
  console.log(`\nAll tables present. Existing users: ${count}`);
}

main()
  .catch((err) => {
    console.error('\nConnection failed:', err.code || err.name);
    console.error(err.message || '(no message)');
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      console.error(
        '\nHostinger blocks outside database connections by default. To connect from your\n' +
          'laptop, add your current IP under Databases > Remote MySQL in hPanel.\n' +
          "(Not needed once the app itself runs on Hostinger — it connects locally.)"
      );
    }
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\nCheck DB_USER and DB_PASSWORD in .env.');
    }
    process.exitCode = 1;
  })
  .finally(() => pool.end());
