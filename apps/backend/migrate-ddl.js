const { Client } = require('pg');

async function migrate() {
  const client = new Client({
    connectionString: 'postgresql://postgres.votkvgtbekyaxgzzbaur:SML0120SML%24@aws-0-eu-west-1.pooler.supabase.com:6543/postgres'
  });
  await client.connect();

  console.log('Connected. Running DDL...');

  await client.query(`
    CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT,
        description TEXT,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT products_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE CASCADE
    );
  `);
  
  await client.query(`CREATE INDEX IF NOT EXISTS products_organization_id_idx ON products(organization_id);`);

  await client.query(`
    ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS product_id TEXT;
  `);

  try {
    await client.query(`
      ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL ON UPDATE CASCADE;
    `);
  } catch(e) {
    console.log('Constraint might already exist, ignoring:', e.message);
  }

  try {
    await client.query(`CREATE INDEX IF NOT EXISTS inventory_items_product_id_idx ON inventory_items(product_id);`);
  } catch(e) {
    console.log('Index might already exist, ignoring:', e.message);
  }

  console.log('DDL successful.');
  process.exit(0);
}

migrate().catch(e => {
  console.error(e);
  process.exit(1);
});
