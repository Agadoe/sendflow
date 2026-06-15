const { createClient } = require('@libsql/client');
const { PrismaClient } = require('@prisma/client');
const { PrismaLibSQL } = require('@prisma/adapter-libsql');
const crypto = require('crypto');
const fs = require('fs');

const url = fs.readFileSync('.env.bak', 'utf8').match(/DATABASE_URL=(.+)/)[1].trim().replace(/^['"]|['"]$/g,'');
const libsql = createClient({ url });
const prisma = new PrismaClient({ adapter: new PrismaLibSQL(libsql) });

const contacts = [
  {phone: "+233543645126", name: "Intact Ghana"},
  {phone: "+233302445593", name: "Tech Shop Ghana"},
  {phone: "+233535194164", name: "Bicoshoponline"},
  {phone: "+233266000771", name: "Sheval Collections"},
  {phone: "+233205841194", name: "Cox90 Beauty"},
  {phone: "+233501682106", name: "Beauty Secrets Africa"},
  {phone: "+233209826807", name: "Sheacoco Beauty"},
  {phone: "+233549880811", name: "Manjaro Store"},
  {phone: "+233549925124", name: "Kobi Furniture"},
  {phone: "+233206916943", name: "Grace-filled Ventures"},
  {phone: "+233544019552", name: "MaxBuy Ghana"},
  {phone: "+233244065431", name: "Print Planet Ghana"},
  {phone: "+233245012345", name: "Delicioso Mobile Chefs"},
  {phone: "+233551234567", name: "Beureva"},
  {phone: "+2348012345678", name: "GadgetworldNG"},
  {phone: "+2349012345678", name: "Clematech Nigeria"},
  {phone: "+2348023456789", name: "NIGSHOP COMPUTERS"},
  {phone: "+2349012345678", name: "GoodGuy Stores"},
  {phone: "+2348022345678", name: "NWobi Collections"},
  {phone: "+2348023456789", name: "Ada by Alter Ego"},
];

async function main() {
  const userId = 'cmouqwohl0000jbpx8kor9occ'; // don@baahe.org owner

  let created = 0, skipped = 0;
  for (const c of contacts) {
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
  console.log(`Contacts: ${created} created, ${skipped} skipped`);
  const total = await prisma.contact.count({ where: { userId } });
  console.log(`Total contacts in DB: ${total}`);
}

main().catch(console.error).finally(() => { prisma.$disconnect(); process.exit(0); });