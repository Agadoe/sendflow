const { createClient } = require('@libsql/client');
const fs = require('fs');
const c = createClient({
  url: 'libsql://sendflow-tedymiles.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzcxNjk4MTUsImlkIjoiMDE5ZGM3OTMtMjgwMS03YmRlLWJiNTgtOTFlNDZiNzMwZWIxIiwicmlkIjoiMjIwM2Y4MzEtNzc3Zi00OTE1LThmNzQtZmRkNjIwZTk2YTNmIn0.ZuiMwhrv1uGxpNoWnTJn3UbknUZibwyZvvbhWhdwocnL96C_a3FN1y6mRUrTPqqvMoDeksvz5fGx1FQL248AAw'
});
const sql = fs.readFileSync('./prisma/migrations/20260604_waitlist_submission/migration.sql', 'utf8');
// Split on ;, skip empties
const stmts = sql.split(/;\s*$/m).map(s => s.trim()).filter(Boolean);
(async () => {
  for (const s of stmts) {
    try {
      await c.execute(s);
      console.log('OK:', s.split('\n')[0].slice(0,80));
    } catch (e) {
      console.log('SKIP:', s.split('\n')[0].slice(0,80), '→', e.message.slice(0,100));
    }
  }
  // Verify
  const t = await c.execute("PRAGMA table_info(WaitlistSubmission)");
  console.log('WaitlistSubmission columns:', t.rows.map(r => r.name).join(', '));
})();
