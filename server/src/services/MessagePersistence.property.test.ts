import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { ScreeningMessageService } from './ScreeningMessageService.js';
import { GroupChatService } from './GroupChatService.js';
import { ScreeningChatService } from './ScreeningChatService.js';
import { BuilderSpaceService } from './BuilderSpaceService.js';
import { TeamFormationService } from './TeamFormationService.js';
import { 
  users, 
  startups, 
  hackathons, 
  applications,
  screeningMessages,
  teamMembers,
  teamSpaces,
  spaceMessages
} from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Feature: team-collaboration-workspace, Property 2: Message Persistence and Real-time Delivery
// **Validates: Requirements 2.1, 2.2, 5.1, 5.2, 8.1**

describe('Message Persistence and Real-time Delivery - Property Tests', () => {
  let db: BetterSQLite3Database<any>;
  let sqlite: Database.Database;
  let screeningMessageService: ScreeningMessageService;
  let groupChatService: GroupChatService;
  let screeningChatService: ScreeningChatService;
  let builderSpaceService: BuilderSpaceService;
  let teamFormationService: TeamFormationService;

  beforeEach(() => {
    // Create in-memory database
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite);
    
    screeningMessageService = new ScreeningMessageService(db);
    groupChatService = new GroupChatService(db);
    screeningChatService = new ScreeningChatService(db);
    builderSpaceService = new BuilderSpaceService(db);
    teamFormationService = new TeamFormationService(db);

    // Create all tables
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

      CREATE TABLE startups (
        id TEXT PRIMARY KEY,
        founder_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        stage TEXT NOT NULL,
        skills_needed TEXT DEFAULT '[]',
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (founder_id) REFERENCES users(id)
      );

      CREATE TABLE hackathons (
        id TEXT PRIMARY KEY,
        creator_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        team_size INTEGER NOT NULL,
        deadline INTEGER NOT NULL,
        skills_needed TEXT DEFAULT '[]',
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (creator_id) REFERENCES users(id)
      );

      CREATE TABLE applications (
        id TEXT PRIMARY KEY,
        applicant_id TEXT NOT NULL,
        post_type TEXT NOT NULL,
        post_id TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (applicant_id) REFERENCES users(id)
      );

      CREATE TABLE screening_messages (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (application_id) REFERENCES applications(id),
        FOREIGN KEY (sender_id) REFERENCES users(id)
      );

      CREATE TABLE team_members (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        post_type TEXT NOT NULL,
        post_id TEXT NOT NULL,
        role TEXT DEFAULT 'member',
        joined_at INTEGER,
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE team_spaces (
        id TEXT PRIMARY KEY,
        post_type TEXT NOT NULL,
        post_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE space_messages (
        id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (space_id) REFERENCES team_spaces(id),
        FOREIGN KEY (sender_id) REFERENCES users(id)
      );
    `);
  });

  afterEach(() => {
    sqlite.close();
  });

  // Custom arbitraries for generating test data
  const userArbitrary = fc.record({
    id: fc.uuid(),
    email: fc.emailAddress().map(email => `${crypto.randomUUID()}_${email}`),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    password: fc.string({ minLength: 6, maxLength: 100 }),
  });

  const postTypeArbitrary = fc.constantFrom('startup', 'hackathon');

  const startupArbitrary = (founderId: string) => fc.record({
    id: fc.uuid(),
    founderId: fc.constant(founderId),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.string({ minLength: 10, maxLength: 500 }),
    stage: fc.constantFrom('Idea', 'Prototype', 'Launched'),
  });

  const hackathonArbitrary = (creatorId: string) => fc.record({
    id: fc.uuid(),
    creatorId: fc.constant(creatorId),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.string({ minLength: 10, maxLength: 500 }),
    teamSize: fc.integer({ min: 1, max: 20 }),
    deadline: fc.integer({ min: Date.now(), max: Date.now() + 365 * 24 * 60 * 60 * 1000 }).map(ts => new Date(ts)),
  });

  const applicationArbitrary = (applicantId: string, postType: string, postId: string) => 
    fc.record({
      id: fc.uuid(),
      applicantId: fc.constant(applicantId),
      postType: fc.constant(postType),
      postId: fc.constant(postId),
      message: fc.string({ minLength: 1, maxLength: 500 }),
    });

  // Generate non-empty message content that won't be sanitized away
  // Use alphanumeric strings with spaces to avoid HTML/special characters that get sanitized
  const messageContentArbitrary = fc.array(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.split('')),
    { minLength: 1, maxLength: 100 }
  ).map(chars => chars.join('')).filter(s => s.trim().length > 0); // Must have non-whitespace content

  describe('Property 2: Message Persistence and Real-time Delivery', () => {
    it('should persist screening messages with correct metadata (timestamp, sender)', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          messageContentArbitrary,
          async (founder, applicant, postType, messageContent) => {
            try {
              // Ensure unique IDs and emails
              if (founder.id === applicant.id) {
                applicant.id = crypto.randomUUID();
              }
              if (founder.email === applicant.email) {
                applicant.email = 'alt_' + applicant.email;
              }

              const now = new Date();

              // Insert users
              await db.insert(users).values([
                { ...founder, createdAt: now, updatedAt: now },
                { ...applicant, createdAt: now, updatedAt: now },
              ]);

              // Create post (startup or hackathon)
              let postId: string;
              if (postType === 'startup') {
                const startup = fc.sample(startupArbitrary(founder.id), 1)[0];
                await db.insert(startups).values({
                  ...startup,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = startup.id;
              } else {
                const hackathon = fc.sample(hackathonArbitrary(founder.id), 1)[0];
                await db.insert(hackathons).values({
                  ...hackathon,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = hackathon.id;
              }

              // Create accepted application
              const application = fc.sample(
                applicationArbitrary(applicant.id, postType, postId),
                1
              )[0];
              await db.insert(applications).values({
                ...application,
                status: 'accepted',
                createdAt: now,
                updatedAt: now,
              });

              // Create screening chat
              await screeningChatService.createScreeningChat(application.id);

              // Send screening message
              const beforeSend = new Date();
              const sentMessage = await screeningMessageService.sendScreeningMessage({
                applicationId: application.id,
                senderId: founder.id,
                content: messageContent,
              });
              const afterSend = new Date();

              // Verify message was persisted with correct metadata
              expect(sentMessage).toBeDefined();
              expect(sentMessage.id).toBeDefined();
              expect(sentMessage.applicationId).toBe(application.id);
              expect(sentMessage.senderId).toBe(founder.id);
              expect(sentMessage.senderName).toBe(founder.name);
              expect(sentMessage.content).toBeTruthy();
              expect(sentMessage.createdAt).toBeInstanceOf(Date);
              expect(sentMessage.updatedAt).toBeInstanceOf(Date);
              
              // Verify timestamp is within reasonable range
              expect(sentMessage.createdAt.getTime()).toBeGreaterThanOrEqual(beforeSend.getTime());
              expect(sentMessage.createdAt.getTime()).toBeLessThanOrEqual(afterSend.getTime());

              // Verify message is persisted in database
              const dbMessages = await db
                .select()
                .from(screeningMessages)
                .where(eq(screeningMessages.id, sentMessage.id));

              expect(dbMessages).toHaveLength(1);
              expect(dbMessages[0].applicationId).toBe(application.id);
              expect(dbMessages[0].senderId).toBe(founder.id);
              expect(dbMessages[0].content).toBeTruthy();
              expect(dbMessages[0].createdAt).toBeInstanceOf(Date);
              expect(dbMessages[0].updatedAt).toBeInstanceOf(Date);

              // Verify both participants can retrieve the message
              const founderMessages = await screeningMessageService.getScreeningMessages(
                application.id,
                founder.id
              );
              expect(founderMessages).toHaveLength(1);
              expect(founderMessages[0].id).toBe(sentMessage.id);
              expect(founderMessages[0].senderId).toBe(founder.id);

              const applicantMessages = await screeningMessageService.getScreeningMessages(
                application.id,
                applicant.id
              );
              expect(applicantMessages).toHaveLength(1);
              expect(applicantMessages[0].id).toBe(sentMessage.id);
              expect(applicantMessages[0].senderId).toBe(founder.id);
            } finally {
              // Clean up for next iteration
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM screening_messages');
              sqlite.exec('DELETE FROM applications');
              sqlite.exec('DELETE FROM startups');
              sqlite.exec('DELETE FROM hackathons');
              sqlite.exec('DELETE FROM users');
              sqlite.exec('PRAGMA foreign_keys = ON');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should persist group messages with correct metadata (timestamp, sender)', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          messageContentArbitrary,
          async (founder, member, postType, messageContent) => {
            try {
              // Ensure unique IDs and emails
              if (founder.id === member.id) {
                member.id = crypto.randomUUID();
              }
              if (founder.email === member.email) {
                member.email = 'alt_' + member.email;
              }

              const now = new Date();

              // Insert users
              await db.insert(users).values([
                { ...founder, createdAt: now, updatedAt: now },
                { ...member, createdAt: now, updatedAt: now },
              ]);

              // Create post
              let postId: string;
              if (postType === 'startup') {
                const startup = fc.sample(startupArbitrary(founder.id), 1)[0];
                await db.insert(startups).values({
                  ...startup,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = startup.id;
              } else {
                const hackathon = fc.sample(hackathonArbitrary(founder.id), 1)[0];
                await db.insert(hackathons).values({
                  ...hackathon,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = hackathon.id;
              }

              // Create team members (founder and member)
              await db.insert(teamMembers).values([
                {
                  id: crypto.randomUUID(),
                  userId: founder.id,
                  postType,
                  postId,
                  role: 'founder',
                  joinedAt: now,
                  createdAt: now,
                  updatedAt: now,
                },
                {
                  id: crypto.randomUUID(),
                  userId: member.id,
                  postType,
                  postId,
                  role: 'member',
                  joinedAt: now,
                  createdAt: now,
                  updatedAt: now,
                },
              ]);

              // Create Builder Space
              const spaceId = crypto.randomUUID();
              await db.insert(teamSpaces).values({
                id: spaceId,
                postType,
                postId,
                name: `${postType} Builder Space`,
                createdAt: now,
                updatedAt: now,
              });

              // Send group message
              const beforeSend = new Date();
              const sentMessage = await groupChatService.sendGroupMessage({
                spaceId,
                senderId: member.id,
                content: messageContent,
              });
              const afterSend = new Date();

              // Verify message was persisted with correct metadata
              expect(sentMessage).toBeDefined();
              expect(sentMessage.id).toBeDefined();
              expect(sentMessage.spaceId).toBe(spaceId);
              expect(sentMessage.senderId).toBe(member.id);
              expect(sentMessage.senderName).toBe(member.name);
              expect(sentMessage.content).toBeTruthy();
              expect(sentMessage.createdAt).toBeInstanceOf(Date);
              expect(sentMessage.updatedAt).toBeInstanceOf(Date);
              
              // Verify timestamp is within reasonable range
              expect(sentMessage.createdAt.getTime()).toBeGreaterThanOrEqual(beforeSend.getTime());
              expect(sentMessage.createdAt.getTime()).toBeLessThanOrEqual(afterSend.getTime());

              // Verify message is persisted in database
              const dbMessages = await db
                .select()
                .from(spaceMessages)
                .where(eq(spaceMessages.id, sentMessage.id));

              expect(dbMessages).toHaveLength(1);
              expect(dbMessages[0].spaceId).toBe(spaceId);
              expect(dbMessages[0].senderId).toBe(member.id);
              expect(dbMessages[0].content).toBeTruthy();
              expect(dbMessages[0].createdAt).toBeInstanceOf(Date);
              expect(dbMessages[0].updatedAt).toBeInstanceOf(Date);

              // Verify all team members can retrieve the message
              const founderMessages = await groupChatService.getGroupMessages(spaceId, founder.id);
              expect(founderMessages).toHaveLength(1);
              expect(founderMessages[0].id).toBe(sentMessage.id);
              expect(founderMessages[0].senderId).toBe(member.id);

              const memberMessages = await groupChatService.getGroupMessages(spaceId, member.id);
              expect(memberMessages).toHaveLength(1);
              expect(memberMessages[0].id).toBe(sentMessage.id);
              expect(memberMessages[0].senderId).toBe(member.id);
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM space_messages');
              sqlite.exec('DELETE FROM team_spaces');
              sqlite.exec('DELETE FROM team_members');
              sqlite.exec('DELETE FROM startups');
              sqlite.exec('DELETE FROM hackathons');
              sqlite.exec('DELETE FROM users');
              sqlite.exec('PRAGMA foreign_keys = ON');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only allow authorized participants to send screening messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          messageContentArbitrary,
          async (founder, applicant, unauthorizedUser, postType, messageContent) => {
            try {
              // Ensure unique IDs and emails
              const users_list = [founder, applicant, unauthorizedUser];
              for (let i = 0; i < users_list.length; i++) {
                for (let j = i + 1; j < users_list.length; j++) {
                  if (users_list[i].id === users_list[j].id) {
                    users_list[j].id = crypto.randomUUID();
                  }
                  if (users_list[i].email === users_list[j].email) {
                    users_list[j].email = `user${j}_${users_list[j].email}`;
                  }
                }
              }

              const now = new Date();

              // Insert users
              await db.insert(users).values([
                { ...founder, createdAt: now, updatedAt: now },
                { ...applicant, createdAt: now, updatedAt: now },
                { ...unauthorizedUser, createdAt: now, updatedAt: now },
              ]);

              // Create post
              let postId: string;
              if (postType === 'startup') {
                const startup = fc.sample(startupArbitrary(founder.id), 1)[0];
                await db.insert(startups).values({
                  ...startup,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = startup.id;
              } else {
                const hackathon = fc.sample(hackathonArbitrary(founder.id), 1)[0];
                await db.insert(hackathons).values({
                  ...hackathon,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = hackathon.id;
              }

              // Create accepted application
              const application = fc.sample(
                applicationArbitrary(applicant.id, postType, postId),
                1
              )[0];
              await db.insert(applications).values({
                ...application,
                status: 'accepted',
                createdAt: now,
                updatedAt: now,
              });

              // Create screening chat
              await screeningChatService.createScreeningChat(application.id);

              // Verify unauthorized user cannot send messages
              let errorThrown = false;
              try {
                await screeningMessageService.sendScreeningMessage({
                  applicationId: application.id,
                  senderId: unauthorizedUser.id,
                  content: messageContent,
                });
              } catch (error: any) {
                errorThrown = true;
                expect(error.message).toContain('Access denied');
              }
              expect(errorThrown).toBe(true);

              // Verify founder can send messages
              const founderMessage = await screeningMessageService.sendScreeningMessage({
                applicationId: application.id,
                senderId: founder.id,
                content: messageContent,
              });
              expect(founderMessage).toBeDefined();
              expect(founderMessage.senderId).toBe(founder.id);

              // Verify applicant can send messages
              const applicantMessage = await screeningMessageService.sendScreeningMessage({
                applicationId: application.id,
                senderId: applicant.id,
                content: messageContent,
              });
              expect(applicantMessage).toBeDefined();
              expect(applicantMessage.senderId).toBe(applicant.id);

              // Verify both messages are persisted
              const messages = await screeningMessageService.getScreeningMessages(
                application.id,
                founder.id
              );
              expect(messages).toHaveLength(2);
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM screening_messages');
              sqlite.exec('DELETE FROM applications');
              sqlite.exec('DELETE FROM startups');
              sqlite.exec('DELETE FROM hackathons');
              sqlite.exec('DELETE FROM users');
              sqlite.exec('PRAGMA foreign_keys = ON');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only allow team members to send group messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          messageContentArbitrary,
          async (founder, member, nonMember, postType, messageContent) => {
            try {
              // Ensure unique IDs and emails
              const users_list = [founder, member, nonMember];
              for (let i = 0; i < users_list.length; i++) {
                for (let j = i + 1; j < users_list.length; j++) {
                  if (users_list[i].id === users_list[j].id) {
                    users_list[j].id = crypto.randomUUID();
                  }
                  if (users_list[i].email === users_list[j].email) {
                    users_list[j].email = `user${j}_${users_list[j].email}`;
                  }
                }
              }

              const now = new Date();

              // Insert users
              await db.insert(users).values([
                { ...founder, createdAt: now, updatedAt: now },
                { ...member, createdAt: now, updatedAt: now },
                { ...nonMember, createdAt: now, updatedAt: now },
              ]);

              // Create post
              let postId: string;
              if (postType === 'startup') {
                const startup = fc.sample(startupArbitrary(founder.id), 1)[0];
                await db.insert(startups).values({
                  ...startup,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = startup.id;
              } else {
                const hackathon = fc.sample(hackathonArbitrary(founder.id), 1)[0];
                await db.insert(hackathons).values({
                  ...hackathon,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = hackathon.id;
              }

              // Create team members (founder and member, but not nonMember)
              await db.insert(teamMembers).values([
                {
                  id: crypto.randomUUID(),
                  userId: founder.id,
                  postType,
                  postId,
                  role: 'founder',
                  joinedAt: now,
                  createdAt: now,
                  updatedAt: now,
                },
                {
                  id: crypto.randomUUID(),
                  userId: member.id,
                  postType,
                  postId,
                  role: 'member',
                  joinedAt: now,
                  createdAt: now,
                  updatedAt: now,
                },
              ]);

              // Create Builder Space
              const spaceId = crypto.randomUUID();
              await db.insert(teamSpaces).values({
                id: spaceId,
                postType,
                postId,
                name: `${postType} Builder Space`,
                createdAt: now,
                updatedAt: now,
              });

              // Verify non-member cannot send messages
              let errorThrown = false;
              try {
                await groupChatService.sendGroupMessage({
                  spaceId,
                  senderId: nonMember.id,
                  content: messageContent,
                });
              } catch (error: any) {
                errorThrown = true;
                expect(error.message).toContain('Access denied');
              }
              expect(errorThrown).toBe(true);

              // Verify founder can send messages
              const founderMessage = await groupChatService.sendGroupMessage({
                spaceId,
                senderId: founder.id,
                content: messageContent,
              });
              expect(founderMessage).toBeDefined();
              expect(founderMessage.senderId).toBe(founder.id);

              // Verify member can send messages
              const memberMessage = await groupChatService.sendGroupMessage({
                spaceId,
                senderId: member.id,
                content: messageContent,
              });
              expect(memberMessage).toBeDefined();
              expect(memberMessage.senderId).toBe(member.id);

              // Verify both messages are persisted
              const messages = await groupChatService.getGroupMessages(spaceId, founder.id);
              expect(messages).toHaveLength(2);
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM space_messages');
              sqlite.exec('DELETE FROM team_spaces');
              sqlite.exec('DELETE FROM team_members');
              sqlite.exec('DELETE FROM startups');
              sqlite.exec('DELETE FROM hackathons');
              sqlite.exec('DELETE FROM users');
              sqlite.exec('PRAGMA foreign_keys = ON');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should persist multiple messages in correct order for screening chats', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          fc.array(messageContentArbitrary, { minLength: 2, maxLength: 10 }),
          async (founder, applicant, postType, messageContents) => {
            try {
              // Ensure unique IDs and emails
              if (founder.id === applicant.id) {
                applicant.id = crypto.randomUUID();
              }
              if (founder.email === applicant.email) {
                applicant.email = 'alt_' + applicant.email;
              }

              const now = new Date();

              // Insert users
              await db.insert(users).values([
                { ...founder, createdAt: now, updatedAt: now },
                { ...applicant, createdAt: now, updatedAt: now },
              ]);

              // Create post
              let postId: string;
              if (postType === 'startup') {
                const startup = fc.sample(startupArbitrary(founder.id), 1)[0];
                await db.insert(startups).values({
                  ...startup,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = startup.id;
              } else {
                const hackathon = fc.sample(hackathonArbitrary(founder.id), 1)[0];
                await db.insert(hackathons).values({
                  ...hackathon,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = hackathon.id;
              }

              // Create accepted application
              const application = fc.sample(
                applicationArbitrary(applicant.id, postType, postId),
                1
              )[0];
              await db.insert(applications).values({
                ...application,
                status: 'accepted',
                createdAt: now,
                updatedAt: now,
              });

              // Create screening chat
              await screeningChatService.createScreeningChat(application.id);

              // Send multiple messages alternating between founder and applicant
              const sentMessages = [];
              for (let i = 0; i < messageContents.length; i++) {
                const senderId = i % 2 === 0 ? founder.id : applicant.id;
                const message = await screeningMessageService.sendScreeningMessage({
                  applicationId: application.id,
                  senderId,
                  content: messageContents[i],
                });
                sentMessages.push(message);
              }

              // Verify all messages are persisted
              const messages = await screeningMessageService.getScreeningMessages(
                application.id,
                founder.id
              );
              expect(messages).toHaveLength(messageContents.length);

              // Verify messages are in chronological order
              for (let i = 1; i < messages.length; i++) {
                expect(messages[i].createdAt.getTime()).toBeGreaterThanOrEqual(
                  messages[i - 1].createdAt.getTime()
                );
              }

              // Verify each message has correct metadata
              for (let i = 0; i < messages.length; i++) {
                expect(messages[i].id).toBe(sentMessages[i].id);
                expect(messages[i].senderId).toBe(sentMessages[i].senderId);
                expect(messages[i].applicationId).toBe(application.id);
                expect(messages[i].createdAt).toBeInstanceOf(Date);
                expect(messages[i].updatedAt).toBeInstanceOf(Date);
              }
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM screening_messages');
              sqlite.exec('DELETE FROM applications');
              sqlite.exec('DELETE FROM startups');
              sqlite.exec('DELETE FROM hackathons');
              sqlite.exec('DELETE FROM users');
              sqlite.exec('PRAGMA foreign_keys = ON');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should persist multiple messages in correct order for group chats', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          fc.array(userArbitrary, { minLength: 1, maxLength: 5 }),
          postTypeArbitrary,
          fc.array(messageContentArbitrary, { minLength: 2, maxLength: 10 }),
          async (founder, members, postType, messageContents) => {
            try {
              // Ensure unique IDs and emails
              const allUsers = [founder, ...members];
              for (let i = 0; i < allUsers.length; i++) {
                for (let j = i + 1; j < allUsers.length; j++) {
                  if (allUsers[i].id === allUsers[j].id) {
                    allUsers[j].id = crypto.randomUUID();
                  }
                  if (allUsers[i].email === allUsers[j].email) {
                    allUsers[j].email = `user${j}_${allUsers[j].email}`;
                  }
                }
              }

              const now = new Date();

              // Insert all users
              await db.insert(users).values(
                allUsers.map(user => ({ ...user, createdAt: now, updatedAt: now }))
              );

              // Create post
              let postId: string;
              if (postType === 'startup') {
                const startup = fc.sample(startupArbitrary(founder.id), 1)[0];
                await db.insert(startups).values({
                  ...startup,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = startup.id;
              } else {
                const hackathon = fc.sample(hackathonArbitrary(founder.id), 1)[0];
                await db.insert(hackathons).values({
                  ...hackathon,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = hackathon.id;
              }

              // Create team members
              const teamMemberValues = allUsers.map(user => ({
                id: crypto.randomUUID(),
                userId: user.id,
                postType,
                postId,
                role: user.id === founder.id ? 'founder' : 'member',
                joinedAt: now,
                createdAt: now,
                updatedAt: now,
              }));
              await db.insert(teamMembers).values(teamMemberValues);

              // Create Builder Space
              const spaceId = crypto.randomUUID();
              await db.insert(teamSpaces).values({
                id: spaceId,
                postType,
                postId,
                name: `${postType} Builder Space`,
                createdAt: now,
                updatedAt: now,
              });

              // Send multiple messages from different team members
              const sentMessages = [];
              for (let i = 0; i < messageContents.length; i++) {
                const sender = allUsers[i % allUsers.length];
                const message = await groupChatService.sendGroupMessage({
                  spaceId,
                  senderId: sender.id,
                  content: messageContents[i],
                });
                sentMessages.push(message);
              }

              // Verify all messages are persisted
              const messages = await groupChatService.getGroupMessages(spaceId, founder.id);
              expect(messages).toHaveLength(messageContents.length);

              // Verify messages are in chronological order
              for (let i = 1; i < messages.length; i++) {
                expect(messages[i].createdAt.getTime()).toBeGreaterThanOrEqual(
                  messages[i - 1].createdAt.getTime()
                );
              }

              // Verify each message has correct metadata
              for (let i = 0; i < messages.length; i++) {
                expect(messages[i].id).toBe(sentMessages[i].id);
                expect(messages[i].senderId).toBe(sentMessages[i].senderId);
                expect(messages[i].spaceId).toBe(spaceId);
                expect(messages[i].createdAt).toBeInstanceOf(Date);
                expect(messages[i].updatedAt).toBeInstanceOf(Date);
              }

              // Verify all team members can access all messages
              for (const user of allUsers) {
                const userMessages = await groupChatService.getGroupMessages(spaceId, user.id);
                expect(userMessages).toHaveLength(messageContents.length);
              }
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM space_messages');
              sqlite.exec('DELETE FROM team_spaces');
              sqlite.exec('DELETE FROM team_members');
              sqlite.exec('DELETE FROM startups');
              sqlite.exec('DELETE FROM hackathons');
              sqlite.exec('DELETE FROM users');
              sqlite.exec('PRAGMA foreign_keys = ON');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
