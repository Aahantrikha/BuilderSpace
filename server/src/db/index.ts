import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import * as schema from './schema.js';

// Load environment variables
dotenv.config({ path: '.env' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Extract the file path from the DATABASE_URL
const dbPath = databaseUrl.replace('file:', '');

// Create SQLite database connection
const sqlite = new Database(dbPath);

// Enable foreign keys
sqlite.pragma('foreign_keys = ON');

// Create tables if they don't exist
const createTablesIfNotExist = () => {
  try {
    // Check if users table exists
    const tableExists = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    
    if (!tableExists) {
      console.log('Creating database tables...');
      
      // Users table
      sqlite.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          password TEXT,
          avatar TEXT,
          college TEXT,
          city TEXT,
          bio TEXT,
          skills TEXT DEFAULT '[]',
          preferences TEXT DEFAULT '{"joinStartup":false,"buildStartup":false,"joinHackathons":false}',
          google_id TEXT,
          email_verified INTEGER DEFAULT 0,
          onboarding_completed INTEGER DEFAULT 0,
          created_at INTEGER,
          updated_at INTEGER
        );
      `);

      // Startups table
      sqlite.exec(`
        CREATE TABLE startups (
          id TEXT PRIMARY KEY,
          founder_id TEXT NOT NULL REFERENCES users(id),
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          stage TEXT NOT NULL,
          skills_needed TEXT DEFAULT '[]',
          created_at INTEGER,
          updated_at INTEGER
        );
      `);

      // Hackathons table
      sqlite.exec(`
        CREATE TABLE hackathons (
          id TEXT PRIMARY KEY,
          creator_id TEXT NOT NULL REFERENCES users(id),
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          team_size INTEGER NOT NULL,
          deadline INTEGER NOT NULL,
          skills_needed TEXT DEFAULT '[]',
          created_at INTEGER,
          updated_at INTEGER
        );
      `);

      // Applications table
      sqlite.exec(`
        CREATE TABLE applications (
          id TEXT PRIMARY KEY,
          applicant_id TEXT NOT NULL REFERENCES users(id),
          post_type TEXT NOT NULL,
          post_id TEXT NOT NULL,
          message TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at INTEGER,
          updated_at INTEGER
        );
      `);

      // Email verification tokens table
      sqlite.exec(`
        CREATE TABLE email_verification_tokens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id),
          token TEXT NOT NULL UNIQUE,
          expires_at INTEGER NOT NULL,
          created_at INTEGER
        );
      `);

      // Screening messages table
      sqlite.exec(`
        CREATE TABLE screening_messages (
          id TEXT PRIMARY KEY,
          application_id TEXT NOT NULL REFERENCES applications(id),
          sender_id TEXT NOT NULL REFERENCES users(id),
          content TEXT NOT NULL,
          created_at INTEGER,
          updated_at INTEGER
        );
      `);

      // Team members table
      sqlite.exec(`
        CREATE TABLE team_members (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id),
          post_type TEXT NOT NULL,
          post_id TEXT NOT NULL,
          role TEXT DEFAULT 'member',
          joined_at INTEGER,
          created_at INTEGER,
          updated_at INTEGER
        );
      `);

      // Team spaces table
      sqlite.exec(`
        CREATE TABLE team_spaces (
          id TEXT PRIMARY KEY,
          post_type TEXT NOT NULL,
          post_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          created_at INTEGER,
          updated_at INTEGER
        );
      `);

      // Space messages table
      sqlite.exec(`
        CREATE TABLE space_messages (
          id TEXT PRIMARY KEY,
          space_id TEXT NOT NULL REFERENCES team_spaces(id),
          sender_id TEXT NOT NULL REFERENCES users(id),
          content TEXT NOT NULL,
          created_at INTEGER,
          updated_at INTEGER
        );
      `);

      // Space links table
      sqlite.exec(`
        CREATE TABLE space_links (
          id TEXT PRIMARY KEY,
          space_id TEXT NOT NULL REFERENCES team_spaces(id),
          creator_id TEXT NOT NULL REFERENCES users(id),
          title TEXT NOT NULL,
          url TEXT NOT NULL,
          description TEXT,
          created_at INTEGER,
          updated_at INTEGER
        );
      `);

      // Space tasks table
      sqlite.exec(`
        CREATE TABLE space_tasks (
          id TEXT PRIMARY KEY,
          space_id TEXT NOT NULL REFERENCES team_spaces(id),
          creator_id TEXT NOT NULL REFERENCES users(id),
          title TEXT NOT NULL,
          description TEXT,
          completed INTEGER DEFAULT 0,
          completed_by TEXT REFERENCES users(id),
          completed_at INTEGER,
          created_at INTEGER,
          updated_at INTEGER
        );
      `);

      console.log('Database tables created successfully!');
    }
  } catch (error) {
    console.error('Error creating tables:', error);
  }
};

// Create tables on startup
createTablesIfNotExist();

export const db = drizzle(sqlite, { schema });

export * from './schema.js';