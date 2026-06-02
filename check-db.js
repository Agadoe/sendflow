const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const cols = await prisma.$queryRawUnsafe("PRAGMA table_info(User);");
    console.log('User columns:');
    for (const c of cols) {
      console.log(`  ${c.name} (${c.type})`);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  await prisma.$disconnect();
})();
