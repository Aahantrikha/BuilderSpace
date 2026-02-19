import { z } from 'zod';

// User validation schemas
export const insertUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6).optional(),
  avatar: z.string().optional(),
  college: z.string().optional(),
  city: z.string().optional(),
  bio: z.string().optional(),
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
  googleId: z.string().optional(),
  emailVerified: z.boolean().default(false),
  onboardingCompleted: z.boolean().default(false),
});

export const updateUserSchema = insertUserSchema.partial();

// Startup validation schemas
export const insertStartupSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(10),
  logo: z.string().optional(),
  stage: z.enum(['Idea', 'Prototype', 'Launched']),
  skillsNeeded: z.array(z.string()).default([]),
});

export const updateStartupSchema = insertStartupSchema.partial();

// Hackathon validation schemas
export const insertHackathonSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(10),
  logo: z.string().optional(),
  teamSize: z.number().min(1).max(20),
  deadline: z.coerce.date(),
  skillsNeeded: z.array(z.string()).default([]),
});

export const updateHackathonSchema = insertHackathonSchema.partial();

// Application validation schemas
export const insertApplicationSchema = z.object({
  postType: z.enum(['startup', 'hackathon']),
  postId: z.string(),
  message: z.string().min(1),
});

export const updateApplicationStatusSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
});

// Screening message validation schemas
export const insertScreeningMessageSchema = z.object({
  content: z.string().min(1),
});

// Team member validation schemas
export const insertTeamMemberSchema = z.object({
  userId: z.string(),
  postType: z.enum(['startup', 'hackathon']),
  postId: z.string(),
  role: z.enum(['founder', 'member']).default('member'),
});

// Team space validation schemas
export const insertTeamSpaceSchema = z.object({
  postType: z.enum(['startup', 'hackathon']),
  postId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
});

// Space message validation schemas
export const insertSpaceMessageSchema = z.object({
  content: z.string().min(1),
});

// Space link validation schemas
export const insertSpaceLinkSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  description: z.string().optional(),
});

// Space task validation schemas
export const insertSpaceTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  completed: z.boolean().default(false),
});

export const updateSpaceTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  completed: z.boolean().optional(),
});
