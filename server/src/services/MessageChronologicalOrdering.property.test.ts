import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { ScreeningMessageService } from './ScreeningMessageService.js';
import { GroupChatService } from './GroupChatService.js';
import { ScreeningChatService } from './ScreeningChatService.js';
import { 
  users, 
  startups, 
  hackathons, 
  applications,
  teamMembers,
  teamSpaces
} from '../db/schema.js';

// Feature: team-collaboration-workspace, Property 3: Message Chronological Ordering
// **Validates: Requirements 2.3, 5.3**

describe('Message Chronological Ordering - Property Tests', () => {
  let db: BetterSQLite3Database<any>;
  let sqlite: Database.Database;
  let screeningMessageService: ScreeningMessageService;
  let groupChatService: GroupChatService;
  let screeningChatService: ScreeningChatService;

  beforeEach(() => {
    // Create in-memory database
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite);
    
    screeningMessageService = new ScreeningMessageService(db);
    groupChatService = new GroupChatService(db);
    screeningChatService = new ScreeningChatService(db);

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
  const messageContentArbitrary = fc.array(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.split('')),
    { minLength: 1, maxLength: 100 }
  ).map(chars => chars.join('')).filter(s => s.trim().length > 0);

  describe('Property 3: Message Chronological Ordering', () => {
    it('should display screening messages in chronological order regardless of send order', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          fc.array(messageContentArbitrary, { minLength: 3, maxLength: 10 }),
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

              // Send messages with small delays to ensure different timestamps
              const sentMessages = [];
              for (let i = 0; i < messageContents.length; i++) {
                const senderId = i % 2 === 0 ? founder.id : applicant.id;
                const message = await screeningMessageService.sendScreeningMessage({
                  applicationId: application.id,
                  senderId,
                  content: messageContents[i],
                });
                sentMessages.push(message);
                
                // Small delay to ensure different timestamps
                await new Promise(resolve => setTimeout(resolve, 5));
              }

              // Retrieve messages
              const retrievedMessages = await screeningMessageService.getScreeningMessages(
                application.id,
                founder.id
              );

              // Verify all messages were retrieved
              expect(retrievedMessages).toHaveLength(sentMessages.length);

              // Verify messages are in chronological order (oldest first)
              for (let i = 1; i < retrievedMessages.length; i++) {
                const prevTimestamp = retrievedMessages[i - 1].createdAt.getTime();
                const currTimestamp = retrievedMessages[i].createdAt.getTime();
                
                // Current message should have timestamp >= previous message
                expect(currTimestamp).toBeGreaterThanOrEqual(prevTimestamp);
              }

              // Verify the order matches the send order
              for (let i = 0; i < sentMessages.length; i++) {
                expect(retrievedMessages[i].id).toBe(sentMessages[i].id);
                expect(retrievedMessages[i].senderId).toBe(sentMessages[i].senderId);
              }

              // Verify applicant also sees messages in same chronological order
              const applicantMessages = await screeningMessageService.getScreeningMessages(
                application.id,
                applicant.id
              );

              expect(applicantMessages).toHaveLength(sentMessages.length);
              for (let i = 0; i < sentMessages.length; i++) {
                expect(applicantMessages[i].id).toBe(retrievedMessages[i].id);
                expect(applicantMessages[i].createdAt.getTime()).toBe(
                  retrievedMessages[i].createdAt.getTime()
                );
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

    it('should display group messages in chronological order regardless of send order', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          fc.array(userArbitrary, { minLength: 2, maxLength: 5 }),
          postTypeArbitrary,
          fc.array(messageContentArbitrary, { minLength: 3, maxLength: 10 }),
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
              const teamMemberRecords = allUsers.map(user => ({
                id: crypto.randomUUID(),
                userId: user.id,
                postType,
                postId,
                role: user.id === founder.id ? 'founder' : 'member',
                joinedAt: now,
                createdAt: now,
                updatedAt: now,
              }));
              await db.insert(teamMembers).values(teamMemberRecords);

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

              // Send messages from different team members with small delays
              const sentMessages = [];
              for (let i = 0; i < messageContents.length; i++) {
                const senderIndex = i % allUsers.length;
                const senderId = allUsers[senderIndex].id;
                
                const message = await groupChatService.sendGroupMessage({
                  spaceId,
                  senderId,
                  content: messageContents[i],
                });
                sentMessages.push(message);
                
                // Small delay to ensure different timestamps
                await new Promise(resolve => setTimeout(resolve, 5));
              }

              // Retrieve messages
              const retrievedMessages = await groupChatService.getGroupMessages(
                spaceId,
                founder.id
              );

              // Verify all messages were retrieved
              expect(retrievedMessages).toHaveLength(sentMessages.length);

              // Verify messages are in chronological order (oldest first)
              for (let i = 1; i < retrievedMessages.length; i++) {
                const prevTimestamp = retrievedMessages[i - 1].createdAt.getTime();
                const currTimestamp = retrievedMessages[i].createdAt.getTime();
                
                // Current message should have timestamp >= previous message
                expect(currTimestamp).toBeGreaterThanOrEqual(prevTimestamp);
              }

              // Verify the order matches the send order
              for (let i = 0; i < sentMessages.length; i++) {
                expect(retrievedMessages[i].id).toBe(sentMessages[i].id);
                expect(retrievedMessages[i].senderId).toBe(sentMessages[i].senderId);
              }

              // Verify all team members see messages in same chronological order
              for (const member of members) {
                const memberMessages = await groupChatService.getGroupMessages(
                  spaceId,
                  member.id
                );

                expect(memberMessages).toHaveLength(sentMessages.length);
                for (let i = 0; i < sentMessages.length; i++) {
                  expect(memberMessages[i].id).toBe(retrievedMessages[i].id);
                  expect(memberMessages[i].createdAt.getTime()).toBe(
                    retrievedMessages[i].createdAt.getTime()
                  );
                }
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

    it('should maintain chronological order when messages have identical timestamps', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          fc.array(messageContentArbitrary, { minLength: 3, maxLength: 5 }),
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

              // Send messages rapidly (may result in same timestamps)
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

              // Retrieve messages multiple times
              const retrieval1 = await screeningMessageService.getScreeningMessages(
                application.id,
                founder.id
              );
              const retrieval2 = await screeningMessageService.getScreeningMessages(
                application.id,
                applicant.id
              );

              // Verify all messages were retrieved
              expect(retrieval1).toHaveLength(sentMessages.length);
              expect(retrieval2).toHaveLength(sentMessages.length);

              // Verify messages are in chronological order (non-decreasing timestamps)
              for (let i = 1; i < retrieval1.length; i++) {
                const prevTimestamp = retrieval1[i - 1].createdAt.getTime();
                const currTimestamp = retrieval1[i].createdAt.getTime();
                expect(currTimestamp).toBeGreaterThanOrEqual(prevTimestamp);
              }

              // Verify consistent ordering across multiple retrievals
              for (let i = 0; i < retrieval1.length; i++) {
                expect(retrieval1[i].id).toBe(retrieval2[i].id);
                expect(retrieval1[i].createdAt.getTime()).toBe(retrieval2[i].createdAt.getTime());
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

    it('should maintain chronological order across different retrieval methods', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          fc.array(messageContentArbitrary, { minLength: 5, maxLength: 10 }),
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

              // Send messages with delays
              const sentMessages = [];
              for (let i = 0; i < messageContents.length; i++) {
                const senderId = i % 2 === 0 ? founder.id : applicant.id;
                const message = await screeningMessageService.sendScreeningMessage({
                  applicationId: application.id,
                  senderId,
                  content: messageContents[i],
                });
                sentMessages.push(message);
                await new Promise(resolve => setTimeout(resolve, 5));
              }

              // Get all messages
              const allMessages = await screeningMessageService.getScreeningMessages(
                application.id,
                founder.id
              );

              // Get latest message
              const latestMessage = await screeningMessageService.getLatestMessage(
                application.id,
                founder.id
              );

              // Verify latest message exists
              expect(latestMessage).not.toBeNull();
              
              // Verify latest message has the most recent timestamp among all messages
              for (const msg of allMessages) {
                expect(latestMessage!.createdAt.getTime()).toBeGreaterThanOrEqual(
                  msg.createdAt.getTime()
                );
              }

              // Verify latest message is one of the messages in the chat
              const latestMessageExists = allMessages.some(msg => msg.id === latestMessage!.id);
              expect(latestMessageExists).toBe(true);

              // Verify that the latest message timestamp matches one of the messages with the max timestamp
              const maxTimestamp = Math.max(...allMessages.map(msg => msg.createdAt.getTime()));
              expect(latestMessage!.createdAt.getTime()).toBe(maxTimestamp);
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
  });
});
