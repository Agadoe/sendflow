const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ datasources: { db: { url: 'file:./prisma/dev.db' } } });

(async () => {
  try {
    const user = await prisma.user.update({
      where: { email: 'admin-test@sendflow.local' },
      data: { role: 'ADMIN' },
      select: { id: true, email: true, role: true }
    });
    console.log('User role updated:', JSON.stringify(user, null, 2));
  } catch (e) {
    console.error('Error updating user role:', e.message);
  }
  await prisma.$disconnect();
})();
