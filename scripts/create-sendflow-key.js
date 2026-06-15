const { PrismaClient } = require('@prisma/client');
const { PrismaLibSQL } = require('@prisma/adapter-libsql');
const { createClient } = require('@libsql/client');
const crypto = require('crypto');

const url = process.env.DATABASE_URL;
const libsql = createClient({ url });
const prisma = new PrismaClient({ adapter: new PrismaLibSQL(libsql) });

async function main() {
  // Find all users - show email and owner status
  const users = await prisma.user.findMany({ take: 10 });
  console.log('Users found:');
  users.forEach(u => console.log(' -', u.id, u.email, u.name, 'owner:', u.isOwner));

  // Create key for owner account
  const owner = users.find(u => u.isOwner) || users[0];
  if (!owner) { console.log('No users found'); return; }
  console.log('\nCreating key for:', owner.email, owner.id);

  const rawKey = 'sf_' + crypto.randomBytes(16).toString('hex');
  const key = await prisma.apiKey.create({ data: { userId: owner.id, key: rawKey } });
  console.log('Key created:', rawKey);
}

main().catch(console.error).finally(() => { prisma.$disconnect(); process.exit(0); });