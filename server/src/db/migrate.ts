import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './index.js';
import postgres from 'postgres';

const migrationClient = postgres(process.env.DATABASE_URL!, { max: 1 });

async function main() {
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations completed!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});