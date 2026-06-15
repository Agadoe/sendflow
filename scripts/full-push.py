import subprocess, os

# Read DATABASE_URL from .env.bak
backup_url = None
if os.path.exists('.env.bak'):
    with open('.env.bak') as f:
        for line in f:
            if line.startswith('DATABASE_URL='):
                backup_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                break
print(f'DATABASE_URL: {backup_url}')

# Step 1: Patch schema to file:./dev.db
with open('prisma/schema.prisma','r') as f: c=f.read()
c = c.replace('url = env("DATABASE_URL")', 'url = "file:./dev.db"')
with open('prisma/schema.prisma','w') as f: f.write(c)
print('Schema patched to file:./dev.db')

# Step 2: Run push with Turso URL as env var (so it CAN connect)
env = os.environ.copy()
env['DATABASE_URL'] = backup_url
print(f'Running push...')
r = subprocess.run(['npx', 'prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], env=env, capture_output=True, text=True)
print(r.stdout)
print(r.stderr)
print('Return code:', r.returncode)

# Step 3: Restore schema (AFTER push, not before!)
with open('prisma/schema.prisma','r') as f: c=f.read()
c = c.replace('url = "file:./dev.db"', 'url = env("DATABASE_URL")')
with open('prisma/schema.prisma','w') as f: f.write(c)
print('Schema restored')