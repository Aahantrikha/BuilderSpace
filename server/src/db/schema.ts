import { pgTable, text, timestamp, boolean, integer, uuid, varchar, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  password: text('password'), // nullable for OAuth users
  avatar: text('avatar'),
  college: varchar('college', { length: 255 }),
  city: varchar('city', { length: 255 }),
  bio: text('bio'),
  skills: jsonb('skills').$type<string[]>().default([]),
  preferences: jsonb('preferences').$type<{
    joinStartup: boolean;
    buildStartup: boolean;
    joinHackathons: boolean;
  }>().default({
    joinStartup: false,
    buildStartup: false,
    joinHackathons: false,
  }),
  googleId: varchar('google_id', { length: 255 }),
  emailVerified: boolean('email_verified').default(false),
  onboardingCompleted: boolean('onboarding_completed').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Startups table
export const startups = pgTable('startups', {
  id: uuid('id').primaryKey().defaultRandom(),
  founderId: uuid('founder_id').references(() => users.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  stage: varchar('stage', { length: 50 }).notNull(), // 'Idea', 'Prototype', 'Launched'
  skillsNeeded: jsonb('skills_needed').$type<string[]>().default([]),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Hackathons table
export const hackathons = pgTable('hackathons', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorId: uuid('creator_id').references(() => users.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  teamSize: integer('team_size').notNull(),
  deadline: timestamp('deadline').notNull(),
  skillsNeeded: jsonb('skills_needed').$type<string[]>().default([]),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Applications table
export const applications = pgTable('applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  applicantId: uuid('applicant_id').references(() => users.id).notNull(),
  postType: varchar('post_type', { length: 20 }).notNull(), // 'startup' | 'hackathon'
  postId: uuid('post_id').notNull(), // references startups.id or hackathons.id
  message: text('message').notNull(),
  status: varchar('status', { length: 20 }).default('pending'), // 'pending', 'accepted', 'rejected'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Email verification tokens
export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email(),
  name: z.string().min(1).max(255),
  password: z.string().min(6).optional(),
  college: z.string().max(255).optional(),
  city: z.string().max(255).optional(),
  bio: z.string().optional(),
  skills: z.array(z.string()).optional(),
});

export const selectUserSchema = createSelectSchema(users);

export const insertStartupSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1),
  stage: z.enum(['Idea', 'Prototype', 'Launched']),
  skillsNeeded: z.array(z.string()).optional(),
});

export const insertHackathonSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1),
  teamSize: z.number().min(1).max(20),
  deadline: z.string().transform((str) => new Date(str)), // Accept string and convert to Date
  skillsNeeded: z.array(z.string()).optional(),
});

export const insertApplicationSchema = z.object({
  postType: z.enum(['startup', 'hackathon']),
  postId: z.string().uuid(),
  message: z.string().min(1),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Startup = typeof startups.$inferSelect;
export type NewStartup = typeof startups.$inferInsert;
export type Hackathon = typeof hackathons.$inferSelect;
export type NewHackathon = typeof hackathons.$inferInsert;
export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;