import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { ScreeningChatService } from './ScreeningChatService.js';
import { ScreeningMessageService } from './ScreeningMessageService.js';
import { BuilderSpaceService } from './BuilderSpaceService.js';
import { GroupChatService } from './GroupChatService.js';
import { SharedLinkService } from './SharedLinkService.js';
import { TaskService } from './TaskService.js';
import { TeamFormationService } from './TeamFormationService.js';
import { 
  users, 
  startups, 
  hackathons, 
  applications,
  teamMembers,
  teamSpaces
} from '../db/schema.js';

// Feature: team-collaboration-workspace, Property 5: Authorization Enforcement
// **Validates: Requirements 1.4, 2.5, 4.2, 5.4**

describe('Authorization Enforcement - Property Tests', () => {
  let db: BetterSQLite3Database<any>;
  let sqlite: Database.Database;
  let screeningChatService: ScreeningChatService;
  let screeningMessageService: ScreeningMessageService;
  let builderSpaceService: BuilderSpaceService;
  let groupChatService: GroupChatService;
  let sharedLinkService: SharedLinkService;
  let taskService: TaskService;
  let teamFormationService: TeamFormationService;

  beforeEach(() => {
    // Create in-memory database
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite);
    
    screeningChatService = new ScreeningChatService(db);
    screeningMessageService = new ScreeningMessageService(db);
    builderSpaceService = new BuilderSpaceService(db);
    groupChatService = new GroupChatService(db);
    sharedLinkService = new SharedLinkService(db);
    taskService = new TaskService(db);
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
        FOREIGN KEY (creator_id) REFERENCES users(id)
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

  const messageContentArbitrary = fc.array(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.split('')),
    { minLength: 1, maxLength: 100 }
  ).map(chars => chars.join('')).filter(s => s.trim().length > 0);

  describe('Property 5: Authorization Enforcement', () => {

    it('should deny unauthorized users access to screening chats while allowing only founder and applicant', async () => {
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

              // Requirement 1.4: Unauthorized users should receive access denied error
              const unauthorizedAccess = await screeningChatService.validateScreeningChatAccess(
                application.id,
                unauthorizedUser.id
              );
              expect(unauthorizedAccess.authorized).toBe(false);

              let errorThrown = false;
              try {
                await screeningChatService.getScreeningChat(application.id, unauthorizedUser.id);
              } catch (error: any) {
                errorThrown = true;
                expect(error.message).toContain('Access denied');
              }
              expect(errorThrown).toBe(true);

              // Verify founder has access
              const founderAccess = await screeningChatService.validateScreeningChatAccess(
                application.id,
                founder.id
              );
              expect(founderAccess.authorized).toBe(true);

              // Verify applicant has access
              const applicantAccess = await screeningChatService.validateScreeningChatAccess(
                application.id,
                applicant.id
              );
              expect(applicantAccess.authorized).toBe(true);
            } finally {
              // Clean up
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

    it('should deny unauthorized users from sending screening messages while allowing only participants', async () => {
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

              // Requirement 2.5: Unauthorized users should not be able to send messages
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

    it('should deny unauthorized users access to Builder Spaces while allowing only team members', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          async (founder, member, nonMember, postType) => {
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

              // Create accepted application for member
              const application = fc.sample(
                applicationArbitrary(member.id, postType, postId),
                1
              )[0];
              await db.insert(applications).values({
                ...application,
                status: 'accepted',
                createdAt: now,
                updatedAt: now,
              });

              // Invite member to Builder Space
              const result = await teamFormationService.inviteToBuilderSpace(
                application.id,
                founder.id
              );

              const spaceId = result.builderSpace.id;

              // Requirement 4.2: Unauthorized users should receive access denied error
              const nonMemberHasAccess = await teamFormationService.validateBuilderSpaceAccess(
                nonMember.id,
                spaceId
              );
              expect(nonMemberHasAccess).toBe(false);

              let errorThrown = false;
              try {
                await builderSpaceService.getBuilderSpace(spaceId, nonMember.id);
              } catch (error: any) {
                errorThrown = true;
                expect(error.message).toContain('Access denied');
              }
              expect(errorThrown).toBe(true);

              // Verify team member has access
              const memberHasAccess = await teamFormationService.validateBuilderSpaceAccess(
                member.id,
                spaceId
              );
              expect(memberHasAccess).toBe(true);

              const space = await builderSpaceService.getBuilderSpace(spaceId, member.id);
              expect(space).toBeDefined();
              expect(space.id).toBe(spaceId);
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM team_members');
              sqlite.exec('DELETE FROM team_spaces');
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

    it('should deny non-team members from sending group messages while allowing only team members', async () => {
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

              // Requirement 5.4: Non-team members should not be able to send messages
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

    it('should deny non-team members from accessing shared links while allowing only team members', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          async (founder, member, nonMember, postType) => {
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

              // Create team members
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

              // Team member adds a link
              const link = await sharedLinkService.addSharedLink({
                spaceId,
                creatorId: member.id,
                title: 'Test Link',
                url: 'https://example.com',
                description: 'Test description',
              });

              // Non-team member should not be able to add links
              let errorThrown = false;
              try {
                await sharedLinkService.addSharedLink({
                  spaceId,
                  creatorId: nonMember.id,
                  title: 'Unauthorized Link',
                  url: 'https://example.com',
                });
              } catch (error: any) {
                errorThrown = true;
                expect(error.message).toContain('Access denied');
              }
              expect(errorThrown).toBe(true);

              // Non-team member should not be able to view links
              errorThrown = false;
              try {
                await sharedLinkService.getSharedLinks(spaceId, nonMember.id);
              } catch (error: any) {
                errorThrown = true;
                expect(error.message).toContain('Access denied');
              }
              expect(errorThrown).toBe(true);

              // Team members should be able to view links
              const founderLinks = await sharedLinkService.getSharedLinks(spaceId, founder.id);
              expect(founderLinks).toHaveLength(1);
              expect(founderLinks[0].id).toBe(link.id);

              const memberLinks = await sharedLinkService.getSharedLinks(spaceId, member.id);
              expect(memberLinks).toHaveLength(1);
              expect(memberLinks[0].id).toBe(link.id);
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM space_links');
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

    it('should deny non-team members from accessing tasks while allowing only team members', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          async (founder, member, nonMember, postType) => {
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

              // Create team members
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

              // Team member creates a task
              const task = await taskService.createTask({
                spaceId,
                creatorId: member.id,
                title: 'Test Task',
                description: 'Test description',
              });

              // Non-team member should not be able to create tasks
              let errorThrown = false;
              try {
                await taskService.createTask({
                  spaceId,
                  creatorId: nonMember.id,
                  title: 'Unauthorized Task',
                });
              } catch (error: any) {
                errorThrown = true;
                expect(error.message).toContain('Access denied');
              }
              expect(errorThrown).toBe(true);

              // Non-team member should not be able to view tasks
              errorThrown = false;
              try {
                await taskService.getTasks(spaceId, nonMember.id);
              } catch (error: any) {
                errorThrown = true;
                expect(error.message).toContain('Access denied');
              }
              expect(errorThrown).toBe(true);

              // Non-team member should not be able to update task status
              errorThrown = false;
              try {
                await taskService.updateTaskStatus({
                  taskId: task.id,
                  userId: nonMember.id,
                  completed: true,
                });
              } catch (error: any) {
                errorThrown = true;
                expect(error.message).toContain('Access denied');
              }
              expect(errorThrown).toBe(true);

              // Team members should be able to view tasks
              const founderTasks = await taskService.getTasks(spaceId, founder.id);
              expect(founderTasks).toHaveLength(1);
              expect(founderTasks[0].id).toBe(task.id);

              const memberTasks = await taskService.getTasks(spaceId, member.id);
              expect(memberTasks).toHaveLength(1);
              expect(memberTasks[0].id).toBe(task.id);

              // Team members should be able to update task status
              const updatedTask = await taskService.updateTaskStatus({
                taskId: task.id,
                userId: founder.id,
                completed: true,
              });
              expect(updatedTask.completed).toBe(true);
              expect(updatedTask.completedBy).toBe(founder.id);
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM space_tasks');
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

    it('should enforce authorization consistently across all collaboration resources', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          messageContentArbitrary,
          async (founder, applicant, teamMember, outsider, postType, messageContent) => {
            try {
              // Ensure unique IDs and emails
              const users_list = [founder, applicant, teamMember, outsider];
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
                { ...teamMember, createdAt: now, updatedAt: now },
                { ...outsider, createdAt: now, updatedAt: now },
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

              // Create accepted application for screening chat
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

              // Invite teamMember to Builder Space
              const application2 = fc.sample(
                applicationArbitrary(teamMember.id, postType, postId),
                1
              )[0];
              await db.insert(applications).values({
                ...application2,
                status: 'accepted',
                createdAt: now,
                updatedAt: now,
              });

              const result = await teamFormationService.inviteToBuilderSpace(
                application2.id,
                founder.id
              );
              const spaceId = result.builderSpace.id;

              // Test 1: Screening chat authorization
              // Outsider should not have access to screening chat
              const outsiderScreeningAccess = await screeningChatService.validateScreeningChatAccess(
                application.id,
                outsider.id
              );
              expect(outsiderScreeningAccess.authorized).toBe(false);

              // Team member (not part of screening) should not have access
              const teamMemberScreeningAccess = await screeningChatService.validateScreeningChatAccess(
                application.id,
                teamMember.id
              );
              expect(teamMemberScreeningAccess.authorized).toBe(false);

              // Founder and applicant should have access
              const founderScreeningAccess = await screeningChatService.validateScreeningChatAccess(
                application.id,
                founder.id
              );
              expect(founderScreeningAccess.authorized).toBe(true);

              const applicantScreeningAccess = await screeningChatService.validateScreeningChatAccess(
                application.id,
                applicant.id
              );
              expect(applicantScreeningAccess.authorized).toBe(true);

              // Test 2: Builder Space authorization
              // Outsider should not have access to Builder Space
              const outsiderSpaceAccess = await teamFormationService.validateBuilderSpaceAccess(
                outsider.id,
                spaceId
              );
              expect(outsiderSpaceAccess).toBe(false);

              // Applicant (not yet team member) should not have access
              const applicantSpaceAccess = await teamFormationService.validateBuilderSpaceAccess(
                applicant.id,
                spaceId
              );
              expect(applicantSpaceAccess).toBe(false);

              // Team member should have access
              const teamMemberSpaceAccess = await teamFormationService.validateBuilderSpaceAccess(
                teamMember.id,
                spaceId
              );
              expect(teamMemberSpaceAccess).toBe(true);

              // Test 3: Group messages authorization
              let errorThrown = false;
              try {
                await groupChatService.sendGroupMessage({
                  spaceId,
                  senderId: outsider.id,
                  content: messageContent,
                });
              } catch (error: any) {
                errorThrown = true;
                expect(error.message).toContain('Access denied');
              }
              expect(errorThrown).toBe(true);

              // Team member should be able to send messages
              const message = await groupChatService.sendGroupMessage({
                spaceId,
                senderId: teamMember.id,
                content: messageContent,
              });
              expect(message).toBeDefined();

              // Test 4: Links authorization
              errorThrown = false;
              try {
                await sharedLinkService.addSharedLink({
                  spaceId,
                  creatorId: outsider.id,
                  title: 'Test',
                  url: 'https://example.com',
                });
              } catch (error: any) {
                errorThrown = true;
                expect(error.message).toContain('Access denied');
              }
              expect(errorThrown).toBe(true);

              // Team member should be able to add links
              const link = await sharedLinkService.addSharedLink({
                spaceId,
                creatorId: teamMember.id,
                title: 'Test Link',
                url: 'https://example.com',
              });
              expect(link).toBeDefined();

              // Test 5: Tasks authorization
              errorThrown = false;
              try {
                await taskService.createTask({
                  spaceId,
                  creatorId: outsider.id,
                  title: 'Test Task',
                });
              } catch (error: any) {
                errorThrown = true;
                expect(error.message).toContain('Access denied');
              }
              expect(errorThrown).toBe(true);

              // Team member should be able to create tasks
              const task = await taskService.createTask({
                spaceId,
                creatorId: teamMember.id,
                title: 'Test Task',
              });
              expect(task).toBeDefined();
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM space_tasks');
              sqlite.exec('DELETE FROM space_links');
              sqlite.exec('DELETE FROM space_messages');
              sqlite.exec('DELETE FROM screening_messages');
              sqlite.exec('DELETE FROM team_spaces');
              sqlite.exec('DELETE FROM team_members');
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
