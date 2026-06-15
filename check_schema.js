const { createClient } = require('@libsql/client');
const c = createClient({
  url: 'libsql://sendflow-tedymiles.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzcxNjk4MTUsImlkIjoiMDE5ZGM3OTMtMjgwMS03YmRlLWJiNTgtOTFlNDZiNzMwZWIxIiwicmlkIjoiMjIwM2Y4MzEtNzc3Zi00OTE1LThmNzQtZmRkNjIwZTk2YTNmIn0.ZuiMwhrv1uGxpNoWnTJn3UbknUZibwyZvvbhWhdwocnL96C_a3FN1y6mRUrTPqqvMoDeksvz5fGx1FQL248AAw'
});
(async () => {
  const t = await c.execute("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('TABLES:', t.rows.map(r => r.name).join(', '));
  const w = await c.execute("PRAGMA table_info(Waitlist)");
  console.log('WAITLIST COLS:', w.rows.map(r => r.name).join(', '));
  const c2 = await c.execute("SELECT COUNT(*) as n FROM Waitlist");
  console.log('COUNT:', c2.rows[0].n);
  const sample = await c.execute("SELECT * FROM Waitlist LIMIT 3");
  console.log('SAMPLE:', JSON.stringify(sample.rows, null, 2));
})();
