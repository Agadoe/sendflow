const { createClient } = require('@libsql/client');
const c = createClient({ url: 'file:./prisma/dev.db' });
(async () => {
  const r = await c.execute("PRAGMA table_info(User);");
  console.log('User columns:');
  for (const col of r.rows) {
    console.log(' ', col.name, col.type);
  }
  const u = await c.execute("SELECT id, email, role FROM User LIMIT 5;");
  console.log('Users:', JSON.stringify(u.rows));
  c.close();
})();
