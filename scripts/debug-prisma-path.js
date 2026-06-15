const path = require('path');
console.log('CWD:', process.cwd());
console.log('Schema file in prisma/schema.prisma');
console.log('process.env.DATABASE_URL:', process.env.DATABASE_URL);

// Prisma resolves file:./ relative to schema location (prisma/)
// So file:./prisma/dev.db → prisma/prisma/dev.db
// To point to prisma/dev.db from project root, you need:
// - file:./dev.db (resolves to prisma/dev.db)
// - or absolute path
