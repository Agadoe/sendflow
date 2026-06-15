const { createClient } = require('@libsql/client');
const { PrismaClient } = require('@prisma/client');
const { PrismaLibSQL } = require('@prisma/adapter-libsql');
const fs = require('fs');

const url = fs.readFileSync('.env.bak', 'utf8').match(/DATABASE_URL=(.+)/)[1].trim().replace(/^['"]|['"]$/g,'');
const libsql = createClient({ url });
const prisma = new PrismaClient({ adapter: new PrismaLibSQL(libsql) });

const remaining = [
  {phone: "+233244065431", name: "Eloquent Prints"},
  {phone: "+233551234567", name: "Beureva"},
  {phone: "+2348012345678", name: "GadgetworldNG"},
  {phone: "+2348023456789", name: "NIGSHOP COMPUTERS"},
  {phone: "+2348022345678", name: "NWobi Collections"},
  {phone: "+2348034567890", name: "MrJay Couture"},
  {phone: "+2349012345678", name: "Shop Uyai Nigeria"},
  {phone: "+2348023456789", name: "Gadget Hub Nigeria"},
  {phone: "+2348034567890", name: "Willytech Stores"},
  {phone: "+2348034567890", name: "Odilux Eco Cosmetics"},
  {phone: "+2348034567890", name: "RH Books Nigeria"},
  {phone: "+2348034567890", name: "Ebooks Nigeria"},
  {phone: "+233302445678", name: "Vidya Bookstore"},
];

async function main() {
  const userId = 'cmouqwohl0000jbpx8kor9occ';
  let created = 0, skipped = 0;
  for (const c of remaining) {
    const phone = c.phone.replace(/\D/g, '');
    try {
      const existing = await prisma.contact.findFirst({ where: { userId, phone } });
      if (existing) { skipped++; continue; }
      await prisma.contact.create({
        data: { userId, phone, name: c.name, tags: JSON.stringify(['sendflow-test']) }
      });
      created++;
    } catch(e) {
      console.log('Error for', c.name, ':', e.message);
    }
  }
  console.log(`Added: ${created}, skipped: ${skipped}`);
  const total = await prisma.contact.count({ where: { userId } });
  console.log(`Total contacts in DB: ${total}`);
}

main().catch(console.error).finally(() => { prisma.$disconnect(); process.exit(0); });