import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { TaskService } from './TaskService.js';
import { BuilderSpaceService } from './BuilderSpaceService.js';
import { TeamFormationService } from './TeamFormationService.js';
import { 
  users, 
  startups, 
  hackathons, 
  applications,
  teamMembers,
  teamSpaces,
  spaceTasks
} from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

// Feature: team-collaboration-workspace, Property 9: Task Status Management
// **Validates: Requirements 7.2, 7.3, 7.4**

describe('Task Status Management - Property Tests', () => {
  let db: BetterSQLite3Database<any>;
  let sqlite: Database.Database;
  let taskService: TaskService;
  let builderSpaceService: BuilderSpaceService;
  let teamFormationService: TeamFormationService;

  beforeEach(() => {
    // Create in-memory database
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite);
    
    taskService = new TaskService(db);
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

  /**
   * Property 9: Task Status Management
   * 
   * For any task, team members should be able to toggle completion status,
   * and the changes should be reflected immediately across all team member views.
   * 
   * This property tests:
   * - Team members can mark tasks as completed (Requirement 7.2)
   * - Task status changes update completion status (Requirement 7.3)
   * - Changes are reflected immediately (Requirement 7.4)
   */
  it('Property 9: Team members can toggle task completion status and changes are reflected immediately', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate test data
        fc.record({
          postType: fc.constantFrom('startup', 'hackathon'),
          taskTitle: fc.string({ minLength: 1, maxLength: 100 }),
          taskDescription: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
          numTeamMembers: fc.integer({ min: 2, max: 5 }),
          toggleSequence: fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
        }),
        async ({ postType, taskTitle, taskDescription, numTeamMembers, toggleSequence }) => {
          // Setup: Create founder
          const founderId = crypto.randomUUID();
          await db.insert(users).values({
            id: founderId,
            email: `founder-${founderId}@example.com`,
            name: 'Founder',
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Setup: Create post (startup or hackathon)
          const postId = crypto.randomUUID();
          if (postType === 'startup') {
            await db.insert(startups).values({
              id: postId,
              founderId,
              name: 'Test Startup',
              description: 'Test Description',
              stage: 'idea',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          } else {
            await db.insert(hackathons).values({
              id: postId,
              creatorId: founderId,
              name: 'Test Hackathon',
              description: 'Test Description',
              teamSize: 5,
              deadline: new Date(Date.now() + 86400000),
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          // Setup: Create team members (including founder as first member)
          const teamMemberIds: string[] = [];
          
          // Add founder as team member first
          await teamFormationService.createTeamMember(founderId, postType, postId, 'founder');
          teamMemberIds.push(founderId);
          
          for (let i = 0; i < numTeamMembers - 1; i++) {
            const memberId = crypto.randomUUID();
            await db.insert(users).values({
              id: memberId,
              email: `member-${memberId}@example.com`,
              name: `Member ${i + 1}`,
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            // Create application
            const applicationId = crypto.randomUUID();
            await db.insert(applications).values({
              id: applicationId,
              applicantId: memberId,
              postType,
              postId,
              message: 'Test application',
              status: 'accepted',
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            // Form team
            await teamFormationService.inviteToBuilderSpace(applicationId, founderId);
            teamMemberIds.push(memberId);
          }

          // Get the Builder Space (it was created during team formation)
          const spaceResult = await builderSpaceService.getBuilderSpaceByPost(postType, postId);
          if (!spaceResult) {
            throw new Error('Builder Space should have been created during team formation');
          }
          const space = spaceResult;

          // Create a task
          const task = await taskService.createTask({
            spaceId: space.id,
            creatorId: founderId,
            title: taskTitle,
            description: taskDescription,
          });

          // Property: Toggle task completion status multiple times
          let expectedCompleted = false;
          let lastCompletedBy: string | undefined;

          for (const shouldComplete of toggleSequence) {
            // Pick a random team member to toggle the status
            const randomMemberIndex = Math.floor(Math.random() * teamMemberIds.length);
            const memberId = teamMemberIds[randomMemberIndex];

            // Toggle the task status
            const updatedTask = await taskService.updateTaskStatus({
              taskId: task.id,
              userId: memberId,
              completed: shouldComplete,
            });

            // Verify: Task status is updated correctly
            expect(updatedTask.completed).toBe(shouldComplete);

            if (shouldComplete) {
              // Verify: completedBy is set to the user who completed it
              expect(updatedTask.completedBy).toBe(memberId);
              expect(updatedTask.completedAt).toBeDefined();
              lastCompletedBy = memberId;
            } else {
              // Verify: completedBy is cleared when marked incomplete
              expect(updatedTask.completedBy).toBeUndefined();
              expect(updatedTask.completedAt).toBeUndefined();
              lastCompletedBy = undefined;
            }

            expectedCompleted = shouldComplete;

            // Verify: All team members see the same status immediately
            for (const teamMemberId of teamMemberIds) {
              const taskView = await taskService.getTask(task.id, teamMemberId);
              
              // Verify: Status is reflected immediately
              expect(taskView.completed).toBe(expectedCompleted);
              
              if (expectedCompleted) {
                expect(taskView.completedBy).toBe(lastCompletedBy);
                expect(taskView.completedAt).toBeDefined();
              } else {
                expect(taskView.completedBy).toBeUndefined();
                expect(taskView.completedAt).toBeUndefined();
              }
            }
          }

          // Verify: Final state is consistent across all views
          const finalTasks = await taskService.getTasks(space.id, founderId);
          const finalTask = finalTasks.find(t => t.id === task.id);
          
          expect(finalTask).toBeDefined();
          expect(finalTask!.completed).toBe(expectedCompleted);
          
          if (expectedCompleted) {
            expect(finalTask!.completedBy).toBe(lastCompletedBy);
            expect(finalTask!.completedAt).toBeDefined();
          } else {
            expect(finalTask!.completedBy).toBeUndefined();
            expect(finalTask!.completedAt).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 } // Run 100 iterations as per design document
    );
  });

  /**
   * Property 9.1: Task completion tracking persists correctly
   * 
   * Verifies that task completion information (who completed it and when)
   * is properly tracked and persisted.
   */
  it('Property 9.1: Task completion tracking persists correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          postType: fc.constantFrom('startup', 'hackathon'),
          taskTitle: fc.string({ minLength: 1, maxLength: 100 }),
          numTeamMembers: fc.integer({ min: 2, max: 4 }),
        }),
        async ({ postType, taskTitle, numTeamMembers }) => {
          // Setup: Create founder
          const founderId = crypto.randomUUID();
          await db.insert(users).values({
            id: founderId,
            email: `founder-${founderId}@example.com`,
            name: 'Founder',
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Setup: Create post
          const postId = crypto.randomUUID();
          if (postType === 'startup') {
            await db.insert(startups).values({
              id: postId,
              founderId,
              name: 'Test Startup',
              description: 'Test Description',
              stage: 'idea',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          } else {
            await db.insert(hackathons).values({
              id: postId,
              creatorId: founderId,
              name: 'Test Hackathon',
              description: 'Test Description',
              teamSize: 5,
              deadline: new Date(Date.now() + 86400000),
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          // Setup: Create team members (including founder as first member)
          const teamMemberIds: string[] = [];
          
          // Add founder as team member first
          await teamFormationService.createTeamMember(founderId, postType, postId, 'founder');
          teamMemberIds.push(founderId);
          
          for (let i = 0; i < numTeamMembers - 1; i++) {
            const memberId = crypto.randomUUID();
            await db.insert(users).values({
              id: memberId,
              email: `member-${memberId}@example.com`,
              name: `Member ${i + 1}`,
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            const applicationId = crypto.randomUUID();
            await db.insert(applications).values({
              id: applicationId,
              applicantId: memberId,
              postType,
              postId,
              message: 'Test application',
              status: 'accepted',
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            await teamFormationService.inviteToBuilderSpace(applicationId, founderId);
            teamMemberIds.push(memberId);
          }

          // Get the Builder Space (it was created during team formation)
          const spaceResult = await builderSpaceService.getBuilderSpaceByPost(postType, postId);
          if (!spaceResult) {
            throw new Error('Builder Space should have been created during team formation');
          }
          const space = spaceResult;

          // Create a task
          const task = await taskService.createTask({
            spaceId: space.id,
            creatorId: founderId,
            title: taskTitle,
          });

          // Pick a random team member to complete the task
          const completerId = teamMemberIds[Math.floor(Math.random() * teamMemberIds.length)];
          const beforeComplete = new Date();

          // Complete the task
          const completedTask = await taskService.updateTaskStatus({
            taskId: task.id,
            userId: completerId,
            completed: true,
          });

          const afterComplete = new Date();

          // Verify: Completion information is tracked
          expect(completedTask.completed).toBe(true);
          expect(completedTask.completedBy).toBe(completerId);
          expect(completedTask.completedAt).toBeDefined();
          
          // Verify: Completion timestamp is reasonable
          const completedAt = completedTask.completedAt!;
          expect(completedAt.getTime()).toBeGreaterThanOrEqual(beforeComplete.getTime());
          expect(completedAt.getTime()).toBeLessThanOrEqual(afterComplete.getTime());

          // Verify: Completion information persists across queries
          const retrievedTask = await taskService.getTask(task.id, founderId);
          expect(retrievedTask.completed).toBe(true);
          expect(retrievedTask.completedBy).toBe(completerId);
          expect(retrievedTask.completedAt).toBeDefined();
          expect(retrievedTask.completedByName).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9.2: Only team members can toggle task status
   * 
   * Verifies that non-team members cannot modify task completion status.
   */
  it('Property 9.2: Only team members can toggle task status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          postType: fc.constantFrom('startup', 'hackathon'),
          taskTitle: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        async ({ postType, taskTitle }) => {
          // Setup: Create founder
          const founderId = crypto.randomUUID();
          await db.insert(users).values({
            id: founderId,
            email: `founder-${founderId}@example.com`,
            name: 'Founder',
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Setup: Create post
          const postId = crypto.randomUUID();
          if (postType === 'startup') {
            await db.insert(startups).values({
              id: postId,
              founderId,
              name: 'Test Startup',
              description: 'Test Description',
              stage: 'idea',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          } else {
            await db.insert(hackathons).values({
              id: postId,
              creatorId: founderId,
              name: 'Test Hackathon',
              description: 'Test Description',
              teamSize: 5,
              deadline: new Date(Date.now() + 86400000),
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          // Setup: Create founder as team member and Builder Space
          await teamFormationService.createTeamMember(founderId, postType, postId, 'founder');
          
          // Create Builder Space manually since there's no team formation
          const spaceName = postType === 'startup' ? 'Test Startup' : 'Test Hackathon';
          const space = await builderSpaceService.createBuilderSpace(postType, postId, spaceName);

          // Create a task
          const task = await taskService.createTask({
            spaceId: space.id,
            creatorId: founderId,
            title: taskTitle,
          });

          // Setup: Create non-team member
          const nonMemberId = crypto.randomUUID();
          await db.insert(users).values({
            id: nonMemberId,
            email: `nonmember-${nonMemberId}@example.com`,
            name: 'Non Member',
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Property: Non-team member cannot toggle task status
          await expect(
            taskService.updateTaskStatus({
              taskId: task.id,
              userId: nonMemberId,
              completed: true,
            })
          ).rejects.toThrow(/Access denied/);

          // Verify: Task status remains unchanged
          const unchangedTask = await taskService.getTask(task.id, founderId);
          expect(unchangedTask.completed).toBe(false);
          expect(unchangedTask.completedBy).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
