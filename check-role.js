const { createClient } = require('@libsql/client');
const c = createClient({ url: 'file:./prisma/dev.db' });
(async () => {
  const r = await c.execute("PRAGMA table_info(User);");
  const cols = r.rows.map(row => row.name);
  console.log('User columns:', cols);
  console.log('Has role column:', cols.includes('role'));
  c.close();
})();
