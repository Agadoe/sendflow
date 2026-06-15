const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  // SQLite exposes path of currently open DB via various means
  // Let's try opening it raw and finding
  const fs = require('fs');
  const candidates = [
    'prisma/dev.db',
    'prisma/prisma/dev.db',
    'dev.db',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      console.log(c, 'size:', fs.statSync(c).size, 'mtime:', fs.statSync(c).mtime);
    }
  }
  await prisma.$disconnect();
})();
