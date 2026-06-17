const { createClient } = require('@libsql/client');

const url = 'libsql://sendflow-tedymiles.aws-ap-northeast-1.turso.io';
const authToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzcxNjk4MTUsImlkIjoiMDE5ZGM3OTMtMjgwMS03YmRlLWJiNTgtOTFlNDZiNzMwZWIxIiwicmlkIjoiMjIwM2Y4MzEtNzc3Zi00OTE1LThmNzQtZmRkNjIwZTk2YTNmIn0.ZuiMwhrv1uGxpNoWnTJn3UbknUZibwyZvvbhWhdwocnL96C_a3FN1y6mRUrTPqqvMoDeksvz5fGx1FQL248AAw';

async function main() {
  const client = createClient({ url, authToken });
  try {
    // Add missing timezone column to User
    await client.execute(`ALTER TABLE User ADD COLUMN timezone TEXT DEFAULT 'UTC'`);
    console.log('Added timezone column to User');
  } catch (e) {
    if (e.message.includes('duplicate column name')) {
      console.log('timezone column already exists');
    } else {
      console.error('Error adding timezone:', e.message);
    }
  }

  // Check ApiKey table for name column
  try {
    const rs = await client.execute("PRAGMA table_info(ApiKey)");
    const cols = rs.rows.map(r => r.name);
    console.log('ApiKey columns:', cols);
    if (!cols.includes('name')) {
      await client.execute(`ALTER TABLE ApiKey ADD COLUMN name TEXT`);
      console.log('Added name column to ApiKey');
    } else {
      console.log('name column already exists on ApiKey');
    }
  } catch (e) {
    console.error('Error checking ApiKey:', e.message);
  }

  await client.close();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
