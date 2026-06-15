const { createClient } = require('@libsql/client');
const c = createClient({
  url: 'libsql://sendflow-tedymiles.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzcxNjk4MTUsImlkIjoiMDE5ZGM3OTMtMjgwMS03YmRlLWJiNTgtOTFlNDZiNzMwZWIxIiwicmlkIjoiMjIwM2Y4MzEtNzc3Zi00OTE1LThmNzQtZmRkNjIwZTk2YTNmIn0.ZuiMwhrv1uGxpNoWnTJn3UbknUZibwyZvvbhWhdwocnL96C_a3FN1y6mRUrTPqqvMoDeksvz5fGx1FQL248AAw'
});
(async () => {
  const r = await c.execute("SELECT id, email, name, phone, businessType, wantsCall, createdAt FROM Waitlist ORDER BY createdAt DESC");
  console.log(JSON.stringify(r.rows, null, 2));
  console.log('TOTAL:', r.rows.length);
})();
