const { PrismaClient } = require('@prisma/client');

async function checkDb(path) {
  const p = new PrismaClient({ datasources: { db: { url: path } } });
  try {
    const cols = await p.$queryRawUnsafe("PRAGMA table_info(User);");
    const colNames = cols.map(c => c.name);
    const users = await p.user.findMany({ select: { id: true, email: true, role: true } });
    console.log(`\n=== ${path} ===`);
    console.log('Has role column:', colNames.includes('role'));
    console.log('Columns:', colNames.join(', '));
    console.log('Users:', JSON.stringify(users, null, 2));
  } catch (e) {
    console.log(`\n=== ${path} === ERROR:`, e.message.split('\n')[0]);
  }
  await p.$disconnect();
}

(async () => {
  await checkDb('file:./prisma/dev.db');   // current .env value
  await checkDb('file:./dev.db');          // relative to schema
  await checkDb('file:./prisma/prisma/dev.db');
})();
