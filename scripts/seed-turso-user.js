const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

const url = 'libsql://sendflow-tedymiles.aws-ap-northeast-1.turso.io';
const authToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzcxNjk4MTUsImlkIjoiMDE5ZGM3OTMtMjgwMS03YmRlLWJiNTgtOTFlNDZiNzMwZWIxIiwicmlkIjoiMjIwM2Y4MzEtNzc3Zi00OTE1LThmNzQtZmRkNjIwZTk2YTNmIn0.ZuiMwhrv1uGxpNoWnTJn3UbknUZibwyZvvbhWhdwocnL96C_a3FN1y6mRUrTPqqvMoDeksvz5fGx1FQL248AAw';

async function main() {
  const client = createClient({ url, authToken });
  const email = 'coreflow@agadoe.com';
  const passwordHash = await bcrypt.hash('TestPass123!', 12);

  try {
    // Check if user exists
    const existing = await client.execute({
      sql: 'SELECT id FROM User WHERE email = ?',
      args: [email],
    });

    if (existing.rows.length > 0) {
      await client.execute({
        sql: 'UPDATE User SET passwordHash = ?, emailVerified = CURRENT_TIMESTAMP, plan = ?, isOwner = 1, role = ?, timezone = ? WHERE email = ?',
        args: [passwordHash, 'FREE', 'ADMIN', 'UTC', email],
      });
      console.log('UPDATED existing user');
    } else {
      const id = 'test_' + Date.now();
      await client.execute({
        sql: 'INSERT INTO User (id, email, name, passwordHash, emailVerified, isOwner, role, plan, timezone, createdAt, updatedAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 1, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        args: [id, email, 'Core Flow', passwordHash, 'ADMIN', 'FREE', 'UTC'],
      });
      console.log('CREATED user', id);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }

  await client.close();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
