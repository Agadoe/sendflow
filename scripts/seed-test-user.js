const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'coreflow@agadoe.com';
  const passwordHash = await bcrypt.hash('TestPass123!', 12);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { emailVerified: new Date(), plan: 'FREE', passwordHash },
    });
    console.log('UPDATED', existing.id);
  } else {
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Core Flow',
        passwordHash,
        emailVerified: new Date(),
        isOwner: true,
        role: 'ADMIN',
        plan: 'FREE',
      },
    });
    console.log('CREATED', user.id);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
