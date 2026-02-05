import { beforeAll, afterAll, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.js';

// Use in-memory database for tests
const sqlite = new Database(':memory:');
sqlite.pragma('foreign_keys = ON');

// Create test database instance
export const testDb = drizzle(sqlite, { schema });

// Create tables before all tests
beforeAll(() => {
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
});

// Clean up after each test
afterEach(() => {
  // Clear all tables
  sqlite.exec('DELETE FROM screening_messages');
  sqlite.exec('DELETE FROM space_messages');
  sqlite.exec('DELETE FROM space_links');
  sqlite.exec('DELETE FROM space_tasks');
  sqlite.exec('DELETE FROM team_members');
  sqlite.exec('DELETE FROM team_spaces');
  sqlite.exec('DELETE FROM applications');
  sqlite.exec('DELETE FROM startups');
  sqlite.exec('DELETE FROM hackathons');
  sqlite.exec('DELETE FROM users');
});

// Close database after all tests
afterAll(() => {
  sqlite.close();
});
