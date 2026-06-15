const { createClient } = require('@libsql/client');
const c = createClient({ url: 'file:./prisma/dev.db' });
(async () => {
  const r = await c.execute("PRAGMA database_list;");
  console.log('Database list:', JSON.stringify(r.rows, null, 2));
  const r2 = await c.execute("PRAGMA table_info(User);");
  console.log('User columns:');
  for (const col of r2.rows) console.log(' ', col.name, col.type);
  c.close();
})();
