const { createClient } = require('@libsql/client');

const url = 'libsql://sendflow-tedymiles.aws-ap-northeast-1.turso.io';
const authToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzcxNjk4MTUsImlkIjoiMDE5ZGM3OTMtMjgwMS03YmRlLWJiNTgtOTFlNDZiNzMwZWIxIiwicmlkIjoiMjIwM2Y4MzEtNzc3Zi00OTE1LThmNzQtZmRkNjIwZTk2YTNmIn0.ZuiMwhrv1uGxpNoWnTJn3UbknUZibwyZvvbhWhdwocnL96C_a3FN1y6mRUrTPqqvMoDeksvz5fGx1FQL248AAw';

async function main() {
  const client = createClient({ url, authToken });
  try {
    const rs = await client.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name='User'");
    console.log('User table info:', rs.rows);
    if (rs.rows.length > 0) {
      const cols = await client.execute("PRAGMA table_info(User)");
      console.log('Columns:', cols.rows.map(r => r.name));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  await client.close();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
