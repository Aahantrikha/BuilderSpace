import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { 
  users, 
  startups, 
  hackathons, 
  applications, 
  screeningMessages,
  teamMembers,
  teamSpaces,
  spaceMessages,
  spaceLinks,
  spaceTasks
} from './schema.js';
import { eq, and } from 'drizzle-orm';

// Feature: team-collaboration-workspace, Property 7: Data Persistence and Integrity
// **Validates: Requirements 9.1, 9.3**

describe('Database Schema Integrity - Property Tests', () => {
  let db: BetterSQLite3Database<any>;
  let sqlite: Database.Database;

  beforeEach(() => {
    // Create in-memory database
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite);

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

      CREATE TABLE space_links (
        id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        description TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (space_id) REFERENCES team_spaces(id),
        FOREIGN KEY (creator_id) REFERENCES users(id)
      );

      CREATE TABLE space_tasks (
        id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        completed INTEGER DEFAULT 0,
        completed_by TEXT,
        completed_at INTEGER,
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (space_id) REFERENCES team_spaces(id),
        FOREIGN KEY (creator_id) REFERENCES users(id),
        FOREIGN KEY (completed_by) REFERENCES users(id)
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
    deadline: fc.date({ min: new Date() }),
  });

  const applicationArbitrary = (applicantId: string, postType: string, postId: string) => 
    fc.record({
      id: fc.uuid(),
      applicantId: fc.constant(applicantId),
      postType: fc.constant(postType),
      postId: fc.constant(postId),
      message: fc.string({ minLength: 1, maxLength: 500 }),
      status: fc.constantFrom('pending', 'accepted', 'rejected'),
    });

  const screeningMessageArbitrary = (applicationId: string, senderId: string) =>
    fc.record({
      id: fc.uuid(),
      applicationId: fc.constant(applicationId),
      senderId: fc.constant(senderId),
      content: fc.string({ minLength: 1, maxLength: 1000 }),
    });

  const teamSpaceArbitrary = (postType: string, postId: string) =>
    fc.record({
      id: fc.uuid(),
      postType: fc.constant(postType),
      postId: fc.constant(postId),
      name: fc.string({ minLength: 1, maxLength: 100 }),
      description: fc.option(fc.string({ minLength: 1, maxLength: 500 })),
    });

  const spaceMessageArbitrary = (spaceId: string, senderId: string) =>
    fc.record({
      id: fc.uuid(),
      spaceId: fc.constant(spaceId),
      senderId: fc.constant(senderId),
      content: fc.string({ minLength: 1, maxLength: 1000 }),
    });

  const spaceLinkArbitrary = (spaceId: string, creatorId: string) =>
    fc.record({
      id: fc.uuid(),
      spaceId: fc.constant(spaceId),
      creatorId: fc.constant(creatorId),
      title: fc.string({ minLength: 1, maxLength: 100 }),
      url: fc.webUrl(),
      description: fc.option(fc.string({ minLength: 1, maxLength: 500 })),
    });

  const spaceTaskArbitrary = (spaceId: string, creatorId: string) =>
    fc.record({
      id: fc.uuid(),
      spaceId: fc.constant(spaceId),
      creatorId: fc.constant(creatorId),
      title: fc.string({ minLength: 1, maxLength: 100 }),
      description: fc.option(fc.string({ minLength: 1, maxLength: 500 })),
      completed: fc.boolean(),
    });

  describe('Property 7: Data Persistence and Integrity', () => {
    it('should persist screening messages with correct metadata and referential integrity', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          async (founder, applicant, postType) => {
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
                const startup = await fc.sample(startupArbitrary(founder.id), 1)[0];
                await db.insert(startups).values({
                  ...startup,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = startup.id;
              } else {
                const hackathon = await fc.sample(hackathonArbitrary(founder.id), 1)[0];
                await db.insert(hackathons).values({
                  ...hackathon,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = hackathon.id;
              }

              // Create application
              const application = await fc.sample(
                applicationArbitrary(applicant.id, postType, postId),
                1
              )[0];
              await db.insert(applications).values({
                ...application,
                status: 'accepted',
                createdAt: now,
                updatedAt: now,
              });

              // Create screening message
              const message = await fc.sample(
                screeningMessageArbitrary(application.id, founder.id),
                1
              )[0];
              await db.insert(screeningMessages).values({
                ...message,
                createdAt: now,
                updatedAt: now,
              });

              // Verify message was persisted with correct metadata
              const retrieved = await db
                .select()
                .from(screeningMessages)
                .where(eq(screeningMessages.id, message.id));

              expect(retrieved).toHaveLength(1);
              expect(retrieved[0].id).toBe(message.id);
              expect(retrieved[0].applicationId).toBe(application.id);
              expect(retrieved[0].senderId).toBe(founder.id);
              expect(retrieved[0].content).toBe(message.content);
              expect(retrieved[0].createdAt).toBeInstanceOf(Date);
              expect(retrieved[0].updatedAt).toBeInstanceOf(Date);

              // Verify referential integrity - message references valid application
              const app = await db
                .select()
                .from(applications)
                .where(eq(applications.id, retrieved[0].applicationId));
              expect(app).toHaveLength(1);

              // Verify referential integrity - message references valid sender
              const sender = await db
                .select()
                .from(users)
                .where(eq(users.id, retrieved[0].senderId));
              expect(sender).toHaveLength(1);
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

    it('should persist team spaces and members with referential integrity', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          async (founder, member, postType) => {
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
                const startup = await fc.sample(startupArbitrary(founder.id), 1)[0];
                await db.insert(startups).values({
                  ...startup,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = startup.id;
              } else {
                const hackathon = await fc.sample(hackathonArbitrary(founder.id), 1)[0];
                await db.insert(hackathons).values({
                  ...hackathon,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = hackathon.id;
              }

              // Create team space
              const space = await fc.sample(teamSpaceArbitrary(postType, postId), 1)[0];
              await db.insert(teamSpaces).values({
                ...space,
                description: space.description || null,
                createdAt: now,
                updatedAt: now,
              });

              // Create team member
              const teamMemberId = crypto.randomUUID();
              await db.insert(teamMembers).values({
                id: teamMemberId,
                userId: member.id,
                postType,
                postId,
                role: 'member',
                joinedAt: now,
                createdAt: now,
                updatedAt: now,
              });

              // Verify team space was persisted
              const retrievedSpace = await db
                .select()
                .from(teamSpaces)
                .where(eq(teamSpaces.id, space.id));

              expect(retrievedSpace).toHaveLength(1);
              expect(retrievedSpace[0].postType).toBe(postType);
              expect(retrievedSpace[0].postId).toBe(postId);

              // Verify team member was persisted with referential integrity
              const retrievedMember = await db
                .select()
                .from(teamMembers)
                .where(eq(teamMembers.id, teamMemberId));

              expect(retrievedMember).toHaveLength(1);
              expect(retrievedMember[0].userId).toBe(member.id);
              expect(retrievedMember[0].postType).toBe(postType);
              expect(retrievedMember[0].postId).toBe(postId);

              // Verify referential integrity - member references valid user
              const user = await db
                .select()
                .from(users)
                .where(eq(users.id, retrievedMember[0].userId));
              expect(user).toHaveLength(1);
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM team_members');
              sqlite.exec('DELETE FROM team_spaces');
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

    it('should persist space messages with correct metadata and referential integrity', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          async (founder, member, postType) => {
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
                const startup = await fc.sample(startupArbitrary(founder.id), 1)[0];
                await db.insert(startups).values({
                  ...startup,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = startup.id;
              } else {
                const hackathon = await fc.sample(hackathonArbitrary(founder.id), 1)[0];
                await db.insert(hackathons).values({
                  ...hackathon,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = hackathon.id;
              }

              // Create team space
              const space = await fc.sample(teamSpaceArbitrary(postType, postId), 1)[0];
              await db.insert(teamSpaces).values({
                ...space,
                description: space.description || null,
                createdAt: now,
                updatedAt: now,
              });

              // Create space message
              const message = await fc.sample(
                spaceMessageArbitrary(space.id, member.id),
                1
              )[0];
              await db.insert(spaceMessages).values({
                ...message,
                createdAt: now,
                updatedAt: now,
              });

              // Verify message was persisted with correct metadata
              const retrieved = await db
                .select()
                .from(spaceMessages)
                .where(eq(spaceMessages.id, message.id));

              expect(retrieved).toHaveLength(1);
              expect(retrieved[0].spaceId).toBe(space.id);
              expect(retrieved[0].senderId).toBe(member.id);
              expect(retrieved[0].content).toBe(message.content);
              expect(retrieved[0].createdAt).toBeInstanceOf(Date);
              expect(retrieved[0].updatedAt).toBeInstanceOf(Date);

              // Verify referential integrity - message references valid space
              const retrievedSpace = await db
                .select()
                .from(teamSpaces)
                .where(eq(teamSpaces.id, retrieved[0].spaceId));
              expect(retrievedSpace).toHaveLength(1);

              // Verify referential integrity - message references valid sender
              const sender = await db
                .select()
                .from(users)
                .where(eq(users.id, retrieved[0].senderId));
              expect(sender).toHaveLength(1);
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM space_messages');
              sqlite.exec('DELETE FROM team_spaces');
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

    it('should persist space links with correct metadata and referential integrity', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          async (founder, member, postType) => {
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
                const startup = await fc.sample(startupArbitrary(founder.id), 1)[0];
                await db.insert(startups).values({
                  ...startup,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = startup.id;
              } else {
                const hackathon = await fc.sample(hackathonArbitrary(founder.id), 1)[0];
                await db.insert(hackathons).values({
                  ...hackathon,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = hackathon.id;
              }

              // Create team space
              const space = await fc.sample(teamSpaceArbitrary(postType, postId), 1)[0];
              await db.insert(teamSpaces).values({
                ...space,
                description: space.description || null,
                createdAt: now,
                updatedAt: now,
              });

              // Create space link
              const link = await fc.sample(
                spaceLinkArbitrary(space.id, member.id),
                1
              )[0];
              await db.insert(spaceLinks).values({
                ...link,
                description: link.description || null,
                createdAt: now,
                updatedAt: now,
              });

              // Verify link was persisted with correct metadata
              const retrieved = await db
                .select()
                .from(spaceLinks)
                .where(eq(spaceLinks.id, link.id));

              expect(retrieved).toHaveLength(1);
              expect(retrieved[0].spaceId).toBe(space.id);
              expect(retrieved[0].creatorId).toBe(member.id);
              expect(retrieved[0].title).toBe(link.title);
              expect(retrieved[0].url).toBe(link.url);
              expect(retrieved[0].createdAt).toBeInstanceOf(Date);
              expect(retrieved[0].updatedAt).toBeInstanceOf(Date);

              // Verify referential integrity - link references valid space
              const retrievedSpace = await db
                .select()
                .from(teamSpaces)
                .where(eq(teamSpaces.id, retrieved[0].spaceId));
              expect(retrievedSpace).toHaveLength(1);

              // Verify referential integrity - link references valid creator
              const creator = await db
                .select()
                .from(users)
                .where(eq(users.id, retrieved[0].creatorId));
              expect(creator).toHaveLength(1);
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM space_links');
              sqlite.exec('DELETE FROM team_spaces');
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

    it('should persist space tasks with correct metadata and referential integrity', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          async (founder, member, postType) => {
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
                const startup = await fc.sample(startupArbitrary(founder.id), 1)[0];
                await db.insert(startups).values({
                  ...startup,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = startup.id;
              } else {
                const hackathon = await fc.sample(hackathonArbitrary(founder.id), 1)[0];
                await db.insert(hackathons).values({
                  ...hackathon,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = hackathon.id;
              }

              // Create team space
              const space = await fc.sample(teamSpaceArbitrary(postType, postId), 1)[0];
              await db.insert(teamSpaces).values({
                ...space,
                description: space.description || null,
                createdAt: now,
                updatedAt: now,
              });

              // Create space task
              const task = await fc.sample(
                spaceTaskArbitrary(space.id, member.id),
                1
              )[0];
              await db.insert(spaceTasks).values({
                ...task,
                description: task.description || null,
                completedBy: task.completed ? member.id : null,
                completedAt: task.completed ? now : null,
                createdAt: now,
                updatedAt: now,
              });

              // Verify task was persisted with correct metadata
              const retrieved = await db
                .select()
                .from(spaceTasks)
                .where(eq(spaceTasks.id, task.id));

              expect(retrieved).toHaveLength(1);
              expect(retrieved[0].spaceId).toBe(space.id);
              expect(retrieved[0].creatorId).toBe(member.id);
              expect(retrieved[0].title).toBe(task.title);
              expect(retrieved[0].completed).toBe(task.completed);
              expect(retrieved[0].createdAt).toBeInstanceOf(Date);
              expect(retrieved[0].updatedAt).toBeInstanceOf(Date);

              // Verify referential integrity - task references valid space
              const retrievedSpace = await db
                .select()
                .from(teamSpaces)
                .where(eq(teamSpaces.id, retrieved[0].spaceId));
              expect(retrievedSpace).toHaveLength(1);

              // Verify referential integrity - task references valid creator
              const creator = await db
                .select()
                .from(users)
                .where(eq(users.id, retrieved[0].creatorId));
              expect(creator).toHaveLength(1);

              // If task is completed, verify completedBy references valid user
              if (retrieved[0].completedBy) {
                const completedByUser = await db
                  .select()
                  .from(users)
                  .where(eq(users.id, retrieved[0].completedBy));
                expect(completedByUser).toHaveLength(1);
              }
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM space_tasks');
              sqlite.exec('DELETE FROM team_spaces');
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

    it('should enforce referential integrity by rejecting invalid foreign keys', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          async (invalidUserId, invalidSpaceId, invalidApplicationId) => {
            const now = new Date();

            // Attempt to insert screening message with invalid application_id
            let errorThrown = false;
            try {
              await db.insert(screeningMessages).values({
                id: crypto.randomUUID(),
                applicationId: invalidApplicationId,
                senderId: invalidUserId,
                content: 'Test message',
                createdAt: now,
                updatedAt: now,
              });
            } catch (error) {
              errorThrown = true;
            }
            expect(errorThrown).toBe(true);

            // Attempt to insert space message with invalid space_id
            errorThrown = false;
            try {
              await db.insert(spaceMessages).values({
                id: crypto.randomUUID(),
                spaceId: invalidSpaceId,
                senderId: invalidUserId,
                content: 'Test message',
                createdAt: now,
                updatedAt: now,
              });
            } catch (error) {
              errorThrown = true;
            }
            expect(errorThrown).toBe(true);

            // Attempt to insert space link with invalid space_id
            errorThrown = false;
            try {
              await db.insert(spaceLinks).values({
                id: crypto.randomUUID(),
                spaceId: invalidSpaceId,
                creatorId: invalidUserId,
                title: 'Test Link',
                url: 'https://example.com',
                createdAt: now,
                updatedAt: now,
              });
            } catch (error) {
              errorThrown = true;
            }
            expect(errorThrown).toBe(true);

            // Attempt to insert space task with invalid space_id
            errorThrown = false;
            try {
              await db.insert(spaceTasks).values({
                id: crypto.randomUUID(),
                spaceId: invalidSpaceId,
                creatorId: invalidUserId,
                title: 'Test Task',
                completed: false,
                createdAt: now,
                updatedAt: now,
              });
            } catch (error) {
              errorThrown = true;
            }
            expect(errorThrown).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
