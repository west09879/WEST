// check-table.js
const db = require('./db');

async function checkTable() {
  await db.initialize();
  const rows = await db.all('SELECT name FROM sqlite_master WHERE type="table" AND name="production_tasks"');
  console.log('Table exists:', rows.length > 0);
  process.exit(0);
}

checkTable().catch(console.error);