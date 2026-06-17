const { createClient } = require('@libsql/client');

const url = 'libsql://sendflow-tedymiles.aws-ap-northeast-1.turso.io';
const authToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzcxNjk4MTUsImlkIjoiMDE5ZGM3OTMtMjgwMS03YmRlLWJiNTgtOTFlNDZiNzMwZWIxIiwicmlkIjoiMjIwM2Y4MzEtNzc3Zi00OTE1LThmNzQtZmRkNjIwZTk2YTNmIn0.ZuiMwhrv1uGxpNoWnTJn3UbknUZibwyZvvbhWhdwocnL96C_a3FN1y6mRUrTPqqvMoDeksvz5fGx1FQL248AAw';

async function main() {
  const client = createClient({ url, authToken });
  try {
    const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    for (const row of tables.rows) {
      const tableName = row.name;
      const cols = await client.execute(`PRAGMA table_info(${tableName})`);
      console.log(`\n${tableName}: ${cols.rows.map(r => r.name).join(', ')}`);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  await client.close();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
