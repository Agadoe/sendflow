const { createClient } = require('@libsql/client');

const client = createClient({ url: 'file:./prisma/dev.db' });

(async () => {
  try {
    const result = await client.execute({
      sql: "UPDATE User SET role = 'ADMIN' WHERE email = ?",
      args: ['admin-test@sendflow.local']
    });
    console.log('Updated rows:', result.rowsAffected);
    
    // Verify the update
    const verify = await client.execute({
      sql: "SELECT id, email, role FROM User WHERE email = ?",
      args: ['admin-test@sendflow.local']
    });
    console.log('User after update:', JSON.stringify(verify.rows, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    client.close();
  }
})();
