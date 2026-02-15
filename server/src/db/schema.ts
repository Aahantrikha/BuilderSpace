import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  password: text('password'), // nullable for OAuth users
  avatar: text('avatar'),
  college: text('college'),
  city: text('city'),
  bio: text('bio'),
  skills: text('skills', { mode: 'json' }).$type<string[]>().default([]),
  preferences: text('preferences', { mode: 'json' }).$type<{
    joinStartup: boolean;
    buildStartup: boolean;
    joinHackathons: boolean;
  }>().default({
    joinStartup: false,
    buildStartup: false,
    joinHackathons: false,
  }),
  googleId: text('google_id'),
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
  onboardingCompleted: integer('onboarding_completed', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Startups table
export const startups = sqliteTable('startups', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  founderId: text('founder_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  logo: text('logo'),
  stage: text('stage').notNull(), // 'Idea', 'Prototype', 'Launched'
  skillsNeeded: text('skills_needed', { mode: 'json' }).$type<string[]>().default([]),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Hackathons table
export const hackathons = sqliteTable('hackathons', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  creatorId: text('creator_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  logo: text('logo'),
  teamSize: integer('team_size').notNull(),
  deadline: integer('deadline', { mode: 'timestamp' }).notNull(),
  skillsNeeded: text('skills_needed', { mode: 'json' }).$type<string[]>().default([]),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Learning Partners table
export const learningPartners = sqliteTable('learning_partners', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  creatorId: text('creator_id').references(() => users.id).notNull(),
  topic: text('topic').notNull(), // e.g., "DSA", "System Design", "React"
  description: text('description').notNull(),
  goal: text('goal').notNull(), // What they want to achieve
  duration: text('duration'), // e.g., "2 months", "Until interview"
  commitment: text('commitment'), // e.g., "2 hours/day", "Weekends only"
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Applications table
export const applications = sqliteTable('applications', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  applicantId: text('applicant_id').references(() => users.id).notNull(),
  postType: text('post_type').notNull(), // 'startup' | 'hackathon' | 'learning_partner'
  postId: text('post_id').notNull(), // references startups.id or hackathons.id or learning_partners.id
  message: text('message').notNull(),
  status: text('status').default('pending'), // 'pending', 'accepted', 'rejected'
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Email verification tokens
export const emailVerificationTokens = sqliteTable('email_verification_tokens', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id).notNull(),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6).optional(),
  skills: z.array(z.string()).default([]),
  preferences: z.object({
    joinStartup: z.boolean(),
    buildStartup: z.boolean(),
    joinHackathons: z.boolean(),
  }).default({
    joinStartup: false,
    buildStartup: false,
    joinHackathons: false,
  }),
});

export const selectUserSchema = createSelectSchema(users);

export const insertStartupSchema = createInsertSchema(startups, {
  name: z.string().min(1),
  description: z.string().min(10),
  stage: z.enum(['Idea', 'Prototype', 'Launched']),
  skillsNeeded: z.array(z.string()).default([]),
}).omit({ founderId: true, id: true, createdAt: true, updatedAt: true });

export const selectStartupSchema = createSelectSchema(startups);

export const insertHackathonSchema = createInsertSchema(hackathons, {
  name: z.string().min(1),
  description: z.string().min(10),
  teamSize: z.number().min(1).max(20),
  deadline: z.coerce.date(), // Use coerce to convert string to date
  skillsNeeded: z.array(z.string()).default([]),
}).omit({ creatorId: true, id: true, createdAt: true, updatedAt: true });

export const selectHackathonSchema = createSelectSchema(hackathons);

export const insertApplicationSchema = createInsertSchema(applications, {
  postType: z.enum(['startup', 'hackathon']),
  message: z.string().min(1),
}).omit({ applicantId: true, id: true, createdAt: true, updatedAt: true, status: true });

export const selectApplicationSchema = createSelectSchema(applications);

// Screening messages table
export const screeningMessages = sqliteTable('screening_messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  applicationId: text('application_id').references(() => applications.id).notNull(),
  senderId: text('sender_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Team members table
export const teamMembers = sqliteTable('team_members', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id).notNull(),
  postType: text('post_type').notNull(), // 'startup' | 'hackathon'
  postId: text('post_id').notNull(), // references startups.id or hackathons.id
  role: text('role').default('member'), // 'founder' | 'member'
  joinedAt: integer('joined_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Team spaces table
export const teamSpaces = sqliteTable('team_spaces', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  postType: text('post_type').notNull(), // 'startup' | 'hackathon'
  postId: text('post_id').notNull(), // references startups.id or hackathons.id
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Space messages table
export const spaceMessages = sqliteTable('space_messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  spaceId: text('space_id').references(() => teamSpaces.id).notNull(),
  senderId: text('sender_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Space links table
export const spaceLinks = sqliteTable('space_links', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  spaceId: text('space_id').references(() => teamSpaces.id).notNull(),
  creatorId: text('creator_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Space tasks table
export const spaceTasks = sqliteTable('space_tasks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  spaceId: text('space_id').references(() => teamSpaces.id).notNull(),
  creatorId: text('creator_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  completed: integer('completed', { mode: 'boolean' }).default(false),
  completedBy: text('completed_by').references(() => users.id),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Zod schemas for new tables
export const insertScreeningMessageSchema = createInsertSchema(screeningMessages, {
  content: z.string().min(1),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const selectScreeningMessageSchema = createSelectSchema(screeningMessages);

export const insertTeamMemberSchema = createInsertSchema(teamMembers, {
  postType: z.enum(['startup', 'hackathon']),
  role: z.enum(['founder', 'member']).default('member'),
}).omit({ id: true, createdAt: true, updatedAt: true, joinedAt: true });

export const selectTeamMemberSchema = createSelectSchema(teamMembers);

export const insertTeamSpaceSchema = createInsertSchema(teamSpaces, {
  postType: z.enum(['startup', 'hackathon']),
  name: z.string().min(1),
  description: z.string().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const selectTeamSpaceSchema = createSelectSchema(teamSpaces);

export const insertSpaceMessageSchema = createInsertSchema(spaceMessages, {
  content: z.string().min(1),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const selectSpaceMessageSchema = createSelectSchema(spaceMessages);

export const insertSpaceLinkSchema = createInsertSchema(spaceLinks, {
  title: z.string().min(1),
  url: z.string().url(),
  description: z.string().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const selectSpaceLinkSchema = createSelectSchema(spaceLinks);

export const insertSpaceTaskSchema = createInsertSchema(spaceTasks, {
  title: z.string().min(1),
  description: z.string().optional(),
  completed: z.boolean().default(false),
}).omit({ id: true, createdAt: true, updatedAt: true, completedBy: true, completedAt: true });

export const selectSpaceTaskSchema = createSelectSchema(spaceTasks);