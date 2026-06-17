const { createClient } = require('@libsql/client');

const url = 'libsql://sendflow-tedymiles.aws-ap-northeast-1.turso.io';
const authToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzcxNjk4MTUsImlkIjoiMDE5ZGM3OTMtMjgwMS03YmRlLWJiNTgtOTFlNDZiNzMwZWIxIiwicmlkIjoiMjIwM2Y4MzEtNzc3Zi00OTE1LThmNzQtZmRkNjIwZTk2YTNmIn0.ZuiMwhrv1uGxpNoWnTJn3UbknUZibwyZvvbhWhdwocnL96C_a3FN1y6mRUrTPqqvMoDeksvz5fGx1FQL248AAw';

async function main() {
  const client = createClient({ url, authToken });
  const statements = [
    `ALTER TABLE Contact ADD COLUMN updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE Contact ADD COLUMN optedIn INTEGER DEFAULT 0`,
    `ALTER TABLE Contact ADD COLUMN optedInAt DATETIME`,
    `ALTER TABLE Contact ADD COLUMN optedInSource TEXT`,
    `ALTER TABLE Contact ADD COLUMN lastMessageContent TEXT`,
    `ALTER TABLE Contact ADD COLUMN lastMessageSentAt DATETIME`,
  ];

  for (const sql of statements) {
    try {
      await client.execute(sql);
      console.log('Executed:', sql.substring(0, 60) + '...');
    } catch (e) {
      if (e.message.includes('duplicate column name')) {
        console.log('Already exists:', sql.substring(0, 40));
      } else {
        console.error('Error:', e.message);
      }
    }
  }

  await client.close();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
