const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, isOwner: true }
  });
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
})();
