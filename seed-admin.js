const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({ datasources: { db: { url: 'file:./prisma/dev.db' } } });

(async () => {
  const passwordHash = await bcrypt.hash('TestAdminPass123!', 12);
  const user = await prisma.user.upsert({
    where: { email: 'admin-test@sendflow.local' },
    update: { role: 'ADMIN', isOwner: true, passwordHash },
    create: {
      email: 'admin-test@sendflow.local',
      name: 'Test Admin',
      role: 'ADMIN',
      isOwner: true,
      passwordHash,
    },
  });
  console.log('Admin created:', JSON.stringify({ id: user.id, email: user.email, role: user.role }, null, 2));
  await prisma.$disconnect();
})();
