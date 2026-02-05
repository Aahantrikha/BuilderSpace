import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { SharedLinkService } from './SharedLinkService.js';
import { TaskService } from './TaskService.js';
import { TeamFormationService } from './TeamFormationService.js';
import { 
  users, 
  startups, 
  hackathons, 
  applications,
  teamMembers,
  teamSpaces,
  spaceLinks,
  spaceTasks
} from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

// Feature: team-collaboration-workspace, Property 10: Creator Ownership Rights
// **Validates: Requirements 6.3, 7.5**

describe('Creator Ownership Rights - Property Tests', () => {
  let db: BetterSQLite3Database<any>;
  let sqlite: Database.Database;
  let sharedLinkService: SharedLinkService;
  let taskService: TaskService;
  let teamFormationService: TeamFormationService;

  beforeEach(() => {
    // Create in-memory database
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite);
    
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

  const linkTitleArbitrary = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
  const taskTitleArbitrary = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
  const descriptionArbitrary = fc.option(
    fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
    { nil: undefined }
  );

  describe('Property 10: Creator Ownership Rights', () => {
    it('should allow only the creator to delete their own links', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          linkTitleArbitrary,
          descriptionArbitrary,
          async (founder, linkCreator, otherMember, postType, linkTitle, linkDescription) => {
            try {
              // Ensure unique IDs and emails
              const users_list = [founder, linkCreator, otherMember];
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
                { ...linkCreator, createdAt: now, updatedAt: now },
                { ...otherMember, createdAt: now, updatedAt: now },
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

              // Create team members (all three users are team members)
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
                  userId: linkCreator.id,
                  postType,
                  postId,
                  role: 'member',
                  joinedAt: now,
                  createdAt: now,
                  updatedAt: now,
                },
                {
                  id: crypto.randomUUID(),
                  userId: otherMember.id,
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

              // Link creator adds a link
              const link = await sharedLinkService.addSharedLink({
                spaceId,
                creatorId: linkCreator.id,
                title: linkTitle,
                url: 'https://github.com/example/repo',
                description: linkDescription,
              });

              // Verify link exists and is visible to all team members
              const linksBeforeDelete = await sharedLinkService.getSharedLinks(spaceId, otherMember.id);
              expect(linksBeforeDelete).toHaveLength(1);
              expect(linksBeforeDelete[0].id).toBe(link.id);
              expect(linksBeforeDelete[0].creatorId).toBe(linkCreator.id);

              // Requirement 6.3: Non-creator should NOT be able to delete the link
              let errorThrown = false;
              try {
                await sharedLinkService.removeSharedLink(link.id, otherMember.id);
              } catch (error: any) {
                errorThrown = true;
                expect(error.message).toContain('Only the link creator can remove this link');
              }
              expect(errorThrown).toBe(true);

              // Verify link still exists after failed deletion attempt
              const linksAfterFailedDelete = await sharedLinkService.getSharedLinks(spaceId, linkCreator.id);
              expect(linksAfterFailedDelete).toHaveLength(1);
              expect(linksAfterFailedDelete[0].id).toBe(link.id);

              // Requirement 6.3: Creator SHOULD be able to delete their own link
              await sharedLinkService.removeSharedLink(link.id, linkCreator.id);

              // Verify link is removed from all team member views
              const linksAfterDelete = await sharedLinkService.getSharedLinks(spaceId, otherMember.id);
              expect(linksAfterDelete).toHaveLength(0);

              // Verify link is also removed from creator's view
              const creatorLinksAfterDelete = await sharedLinkService.getSharedLinks(spaceId, linkCreator.id);
              expect(creatorLinksAfterDelete).toHaveLength(0);

              // Verify link is removed from database
              const dbLinks = await db
                .select()
                .from(spaceLinks)
                .where(eq(spaceLinks.id, link.id));
              expect(dbLinks).toHaveLength(0);
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM space_links');
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

    it('should allow only the creator to delete their own tasks', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          taskTitleArbitrary,
          descriptionArbitrary,
          async (founder, taskCreator, otherMember, postType, taskTitle, taskDescription) => {
            try {
              // Ensure unique IDs and emails
              const users_list = [founder, taskCreator, otherMember];
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
                { ...taskCreator, createdAt: now, updatedAt: now },
                { ...otherMember, createdAt: now, updatedAt: now },
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

              // Create team members (all three users are team members)
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
                  userId: taskCreator.id,
                  postType,
                  postId,
                  role: 'member',
                  joinedAt: now,
                  createdAt: now,
                  updatedAt: now,
                },
                {
                  id: crypto.randomUUID(),
                  userId: otherMember.id,
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

              // Task creator creates a task
              const task = await taskService.createTask({
                spaceId,
                creatorId: taskCreator.id,
                title: taskTitle,
                description: taskDescription,
              });

              // Verify task exists and is visible to all team members
              const tasksBeforeDelete = await taskService.getTasks(spaceId, otherMember.id);
              expect(tasksBeforeDelete).toHaveLength(1);
              expect(tasksBeforeDelete[0].id).toBe(task.id);
              expect(tasksBeforeDelete[0].creatorId).toBe(taskCreator.id);

              // Requirement 7.5: Non-creator should NOT be able to delete the task
              let errorThrown = false;
              try {
                await taskService.deleteTask(task.id, otherMember.id);
              } catch (error: any) {
                errorThrown = true;
                expect(error.message).toContain('Only the task creator can delete this task');
              }
              expect(errorThrown).toBe(true);

              // Verify task still exists after failed deletion attempt
              const tasksAfterFailedDelete = await taskService.getTasks(spaceId, taskCreator.id);
              expect(tasksAfterFailedDelete).toHaveLength(1);
              expect(tasksAfterFailedDelete[0].id).toBe(task.id);

              // Requirement 7.5: Creator SHOULD be able to delete their own task
              await taskService.deleteTask(task.id, taskCreator.id);

              // Verify task is removed from all team member views
              const tasksAfterDelete = await taskService.getTasks(spaceId, otherMember.id);
              expect(tasksAfterDelete).toHaveLength(0);

              // Verify task is also removed from creator's view
              const creatorTasksAfterDelete = await taskService.getTasks(spaceId, taskCreator.id);
              expect(creatorTasksAfterDelete).toHaveLength(0);

              // Verify task is removed from database
              const dbTasks = await db
                .select()
                .from(spaceTasks)
                .where(eq(spaceTasks.id, task.id));
              expect(dbTasks).toHaveLength(0);
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM space_tasks');
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

    it('should enforce creator ownership for multiple links and tasks', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          fc.array(userArbitrary, { minLength: 2, maxLength: 4 }),
          postTypeArbitrary,
          fc.array(linkTitleArbitrary, { minLength: 1, maxLength: 3 }),
          fc.array(taskTitleArbitrary, { minLength: 1, maxLength: 3 }),
          async (founder, members, postType, linkTitles, taskTitles) => {
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
                ...members.map(member => ({
                  id: crypto.randomUUID(),
                  userId: member.id,
                  postType,
                  postId,
                  role: 'member' as const,
                  joinedAt: now,
                  createdAt: now,
                  updatedAt: now,
                })),
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

              // Each member creates links
              const createdLinks: { linkId: string; creatorId: string }[] = [];
              for (let i = 0; i < Math.min(linkTitles.length, members.length); i++) {
                const link = await sharedLinkService.addSharedLink({
                  spaceId,
                  creatorId: members[i].id,
                  title: linkTitles[i],
                  url: `https://example.com/link${i}`,
                });
                createdLinks.push({ linkId: link.id, creatorId: members[i].id });
              }

              // Each member creates tasks
              const createdTasks: { taskId: string; creatorId: string }[] = [];
              for (let i = 0; i < Math.min(taskTitles.length, members.length); i++) {
                const task = await taskService.createTask({
                  spaceId,
                  creatorId: members[i].id,
                  title: taskTitles[i],
                });
                createdTasks.push({ taskId: task.id, creatorId: members[i].id });
              }

              // Verify all links and tasks are visible to all members
              const allLinks = await sharedLinkService.getSharedLinks(spaceId, founder.id);
              expect(allLinks).toHaveLength(createdLinks.length);

              const allTasks = await taskService.getTasks(spaceId, founder.id);
              expect(allTasks).toHaveLength(createdTasks.length);

              // Test that each creator can only delete their own content
              for (const { linkId, creatorId } of createdLinks) {
                // Find a different member who is not the creator
                const nonCreator = members.find(m => m.id !== creatorId);
                if (nonCreator) {
                  // Non-creator should NOT be able to delete
                  let errorThrown = false;
                  try {
                    await sharedLinkService.removeSharedLink(linkId, nonCreator.id);
                  } catch (error: any) {
                    errorThrown = true;
                    expect(error.message).toContain('Only the link creator can remove this link');
                  }
                  expect(errorThrown).toBe(true);
                }

                // Creator SHOULD be able to delete
                await sharedLinkService.removeSharedLink(linkId, creatorId);
              }

              for (const { taskId, creatorId } of createdTasks) {
                // Find a different member who is not the creator
                const nonCreator = members.find(m => m.id !== creatorId);
                if (nonCreator) {
                  // Non-creator should NOT be able to delete
                  let errorThrown = false;
                  try {
                    await taskService.deleteTask(taskId, nonCreator.id);
                  } catch (error: any) {
                    errorThrown = true;
                    expect(error.message).toContain('Only the task creator can delete this task');
                  }
                  expect(errorThrown).toBe(true);
                }

                // Creator SHOULD be able to delete
                await taskService.deleteTask(taskId, creatorId);
              }

              // Verify all links and tasks are removed from all member views
              const linksAfterDelete = await sharedLinkService.getSharedLinks(spaceId, founder.id);
              expect(linksAfterDelete).toHaveLength(0);

              const tasksAfterDelete = await taskService.getTasks(spaceId, founder.id);
              expect(tasksAfterDelete).toHaveLength(0);
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM space_links');
              sqlite.exec('DELETE FROM space_tasks');
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

    it('should prevent deletion of links and tasks by non-team members', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          linkTitleArbitrary,
          taskTitleArbitrary,
          async (founder, creator, nonMember, postType, linkTitle, taskTitle) => {
            try {
              // Ensure unique IDs and emails
              const users_list = [founder, creator, nonMember];
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
                { ...creator, createdAt: now, updatedAt: now },
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

              // Create team members (founder and creator, but NOT nonMember)
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
                  userId: creator.id,
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

              // Creator creates a link
              const link = await sharedLinkService.addSharedLink({
                spaceId,
                creatorId: creator.id,
                title: linkTitle,
                url: 'https://github.com/example/repo',
              });

              // Creator creates a task
              const task = await taskService.createTask({
                spaceId,
                creatorId: creator.id,
                title: taskTitle,
              });

              // Non-member should NOT be able to delete link (not even the creator's own content)
              let linkErrorThrown = false;
              try {
                await sharedLinkService.removeSharedLink(link.id, nonMember.id);
              } catch (error: any) {
                linkErrorThrown = true;
                // Should fail because non-member is not a team member
                expect(error.message).toContain('Access denied');
              }
              expect(linkErrorThrown).toBe(true);

              // Non-member should NOT be able to delete task
              let taskErrorThrown = false;
              try {
                await taskService.deleteTask(task.id, nonMember.id);
              } catch (error: any) {
                taskErrorThrown = true;
                // Should fail because non-member is not a team member
                expect(error.message).toContain('Access denied');
              }
              expect(taskErrorThrown).toBe(true);

              // Verify link and task still exist
              const links = await sharedLinkService.getSharedLinks(spaceId, creator.id);
              expect(links).toHaveLength(1);
              expect(links[0].id).toBe(link.id);

              const tasks = await taskService.getTasks(spaceId, creator.id);
              expect(tasks).toHaveLength(1);
              expect(tasks[0].id).toBe(task.id);
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM space_links');
              sqlite.exec('DELETE FROM space_tasks');
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
