import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dotenv from 'dotenv';
import * as schema from './schema.js';

// Load environment variables
dotenv.config({ path: '.env' });

const connectionString = process.env.DATABASE_URL!;

// Configure postgres client with explicit options
const client = postgres(connectionString, { 
  prepare: false,
  username: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'builderspace',
  // No password needed for local setup
});

export const db = drizzle(client, { schema });

export * from './schema.js';