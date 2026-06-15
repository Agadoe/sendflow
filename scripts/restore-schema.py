with open('prisma/schema.prisma','r') as f: c=f.read()
c = c.replace('url = "file:./dev.db"', 'url = env("DATABASE_URL")')
with open('prisma/schema.prisma','w') as f: f.write(c)
print('Restored')