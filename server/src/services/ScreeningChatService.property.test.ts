import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { ScreeningChatService } from './ScreeningChatService.js';
import { 
  users, 
  startups, 
  hackathons, 
  applications
} from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Feature: team-collaboration-workspace, Property 1: Screening Chat Creation and Access Control
// **Validates: Requirements 1.1, 1.3, 1.4, 1.5**

describe('ScreeningChatService - Property Tests', () => {
  let db: BetterSQLite3Database<any>;
  let sqlite: Database.Database;
  let service: ScreeningChatService;

  beforeEach(() => {
    // Create in-memory database
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite);
    service = new ScreeningChatService(db);

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

  describe('Property 1: Screening Chat Creation and Access Control', () => {
    it('should create screening chat with exactly two authorized participants (founder and applicant)', async () => {
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

              // Create accepted application
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

              // Create screening chat
              const chat = await service.createScreeningChat(application.id);

              // Verify chat was created with correct participants
              expect(chat).toBeDefined();
              expect(chat.founderId).toBe(founder.id);
              expect(chat.applicantId).toBe(applicant.id);
              expect(chat.applicationId).toBe(application.id);
              expect(chat.postType).toBe(postType);
              expect(chat.postId).toBe(postId);
              expect(chat.status).toBe('accepted');

              // Verify exactly two participants can access the chat
              // Founder should have access
              const founderAccess = await service.validateScreeningChatAccess(
                application.id,
                founder.id
              );
              expect(founderAccess.authorized).toBe(true);
              expect(founderAccess.participants?.founderId).toBe(founder.id);
              expect(founderAccess.participants?.applicantId).toBe(applicant.id);

              // Applicant should have access
              const applicantAccess = await service.validateScreeningChatAccess(
                application.id,
                applicant.id
              );
              expect(applicantAccess.authorized).toBe(true);
              expect(applicantAccess.participants?.founderId).toBe(founder.id);
              expect(applicantAccess.participants?.applicantId).toBe(applicant.id);
            } finally {
              // Clean up for next iteration
              sqlite.exec('PRAGMA foreign_keys = OFF');
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

    it('should deny access to unauthorized users while allowing only founder and applicant', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          async (founder, applicant, unauthorizedUser, postType) => {
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

              // Create accepted application
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

              // Create screening chat
              await service.createScreeningChat(application.id);

              // Verify unauthorized user is denied access
              const unauthorizedAccess = await service.validateScreeningChatAccess(
                application.id,
                unauthorizedUser.id
              );
              expect(unauthorizedAccess.authorized).toBe(false);
              expect(unauthorizedAccess.participants).toBeUndefined();

              // Verify getScreeningChat throws error for unauthorized user
              let errorThrown = false;
              try {
                await service.getScreeningChat(application.id, unauthorizedUser.id);
              } catch (error: any) {
                errorThrown = true;
                expect(error.message).toContain('Access denied');
              }
              expect(errorThrown).toBe(true);

              // Verify founder still has access
              const founderChat = await service.getScreeningChat(application.id, founder.id);
              expect(founderChat.founderId).toBe(founder.id);
              expect(founderChat.applicantId).toBe(applicant.id);

              // Verify applicant still has access
              const applicantChat = await service.getScreeningChat(application.id, applicant.id);
              expect(applicantChat.founderId).toBe(founder.id);
              expect(applicantChat.applicantId).toBe(applicant.id);
            } finally {
              // Clean up for next iteration
              sqlite.exec('PRAGMA foreign_keys = OFF');
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

    it('should maintain separate screening chats for each founder-applicant pair per team', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          fc.array(userArbitrary, { minLength: 2, maxLength: 5 }),
          postTypeArbitrary,
          async (founder, applicants, postType) => {
            try {
              // Ensure unique IDs and emails
              const allUsers = [founder, ...applicants];
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

              // Create accepted applications for each applicant
              const applicationIds: string[] = [];
              for (const applicant of applicants) {
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
                applicationIds.push(application.id);
              }

              // Create screening chats for each application
              const chats = await Promise.all(
                applicationIds.map(appId => service.createScreeningChat(appId))
              );

              // Verify each chat is separate and has correct participants
              expect(chats).toHaveLength(applicants.length);
              
              for (let i = 0; i < chats.length; i++) {
                const chat = chats[i];
                const applicant = applicants[i];

                // Each chat should have the same founder but different applicant
                expect(chat.founderId).toBe(founder.id);
                expect(chat.applicantId).toBe(applicant.id);
                expect(chat.applicationId).toBe(applicationIds[i]);

                // Each chat should be accessible only by its specific founder-applicant pair
                const founderAccess = await service.getScreeningChat(
                  applicationIds[i],
                  founder.id
                );
                expect(founderAccess.applicantId).toBe(applicant.id);

                const applicantAccess = await service.getScreeningChat(
                  applicationIds[i],
                  applicant.id
                );
                expect(applicantAccess.founderId).toBe(founder.id);

                // Other applicants should not have access to this chat
                for (let j = 0; j < applicants.length; j++) {
                  if (i !== j) {
                    const otherApplicant = applicants[j];
                    const otherAccess = await service.validateScreeningChatAccess(
                      applicationIds[i],
                      otherApplicant.id
                    );
                    expect(otherAccess.authorized).toBe(false);
                  }
                }
              }

              // Verify all chat IDs are unique
              const chatIds = chats.map(chat => chat.id);
              const uniqueChatIds = new Set(chatIds);
              expect(uniqueChatIds.size).toBe(chats.length);
            } finally {
              // Clean up for next iteration
              sqlite.exec('PRAGMA foreign_keys = OFF');
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

    it('should only create screening chats for accepted applications', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          fc.constantFrom('pending', 'rejected'),
          async (founder, applicant, postType, invalidStatus) => {
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

              // Create application with non-accepted status
              const application = await fc.sample(
                applicationArbitrary(applicant.id, postType, postId),
                1
              )[0];
              await db.insert(applications).values({
                ...application,
                status: invalidStatus,
                createdAt: now,
                updatedAt: now,
              });

              // Attempt to create screening chat should fail
              let errorThrown = false;
              try {
                await service.createScreeningChat(application.id);
              } catch (error: any) {
                errorThrown = true;
                expect(error.message).toContain('Application must be accepted');
              }
              expect(errorThrown).toBe(true);

              // Now update to accepted and verify it works
              await db
                .update(applications)
                .set({ status: 'accepted' })
                .where(eq(applications.id, application.id));

              const chat = await service.createScreeningChat(application.id);
              expect(chat).toBeDefined();
              expect(chat.founderId).toBe(founder.id);
              expect(chat.applicantId).toBe(applicant.id);
              expect(chat.status).toBe('accepted');
            } finally {
              // Clean up for next iteration
              sqlite.exec('PRAGMA foreign_keys = OFF');
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

    it('should handle both startup and hackathon post types correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          fc.tuple(
            fc.uuid(),
            fc.string({ minLength: 1, maxLength: 100 }),
            fc.string({ minLength: 10, maxLength: 500 }),
            fc.constantFrom('Idea', 'Prototype', 'Launched')
          ),
          fc.tuple(
            fc.uuid(),
            fc.string({ minLength: 1, maxLength: 100 }),
            fc.string({ minLength: 10, maxLength: 500 }),
            fc.integer({ min: 1, max: 20 }),
            fc.integer({ min: Date.now(), max: Date.now() + 365 * 24 * 60 * 60 * 1000 }).map(ts => new Date(ts))
          ),
          async (founder, applicant, startupData, hackathonData) => {
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

              // Create both startup and hackathon
              const [startupId, startupName, startupDesc, startupStage] = startupData;
              await db.insert(startups).values({
                id: startupId,
                founderId: founder.id,
                name: startupName,
                description: startupDesc,
                stage: startupStage,
                createdAt: now,
                updatedAt: now,
              });

              const [hackathonId, hackathonName, hackathonDesc, hackathonTeamSize, hackathonDeadline] = hackathonData;
              await db.insert(hackathons).values({
                id: hackathonId,
                creatorId: founder.id,
                name: hackathonName,
                description: hackathonDesc,
                teamSize: hackathonTeamSize,
                deadline: hackathonDeadline,
                createdAt: now,
                updatedAt: now,
              });

              // Create accepted applications for both
              const startupApp = await fc.sample(
                applicationArbitrary(applicant.id, 'startup', startupId),
                1
              )[0];
              await db.insert(applications).values({
                ...startupApp,
                status: 'accepted',
                createdAt: now,
                updatedAt: now,
              });

              const hackathonApp = await fc.sample(
                applicationArbitrary(applicant.id, 'hackathon', hackathonId),
                1
              )[0];
              await db.insert(applications).values({
                ...hackathonApp,
                status: 'accepted',
                createdAt: now,
                updatedAt: now,
              });

              // Create screening chats for both
              const startupChat = await service.createScreeningChat(startupApp.id);
              const hackathonChat = await service.createScreeningChat(hackathonApp.id);

              // Verify both chats were created correctly
              expect(startupChat.postType).toBe('startup');
              expect(startupChat.postId).toBe(startupId);
              expect(startupChat.founderId).toBe(founder.id);
              expect(startupChat.applicantId).toBe(applicant.id);

              expect(hackathonChat.postType).toBe('hackathon');
              expect(hackathonChat.postId).toBe(hackathonId);
              expect(hackathonChat.founderId).toBe(founder.id);
              expect(hackathonChat.applicantId).toBe(applicant.id);

              // Verify both chats are separate and accessible
              const startupAccess = await service.getScreeningChat(startupApp.id, founder.id);
              expect(startupAccess.postType).toBe('startup');

              const hackathonAccess = await service.getScreeningChat(hackathonApp.id, founder.id);
              expect(hackathonAccess.postType).toBe('hackathon');

              // Verify chats are independent
              expect(startupChat.id).not.toBe(hackathonChat.id);
            } finally {
              // Clean up for next iteration
              sqlite.exec('PRAGMA foreign_keys = OFF');
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
