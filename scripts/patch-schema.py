import re
with open('prisma/schema.prisma','r') as f: c=f.read()
c = c.replace('url = env("DATABASE_URL")', 'url = "file:./dev.db"')
with open('prisma/schema.prisma','w') as f: f.write(c)
print('Patched')