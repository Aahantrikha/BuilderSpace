import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { TaskService } from './TaskService.js';
import { BuilderSpaceService } from './BuilderSpaceService.js';
import { TeamFormationService } from './TeamFormationService.js';
import { users, startups, applications, teamMembers, teamSpaces, spaceTasks } from '../db/schema.js';
import { eq } from 'drizzle-orm';

describe('TaskService', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;
  let taskService: TaskService;
  let builderSpaceService: BuilderSpaceService;
  let teamFormationService: TeamFormationService;

  // Test data
  let founderId: string;
  let applicantId: string;
  let startupId: string;
  let applicationId: string;
  let spaceId: string;

  beforeEach(async () => {
    // Create in-memory database
    sqlite = new Database(':memory:');
    db = drizzle(sqlite);

    // Create tables
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
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE startups (
        id TEXT PRIMARY KEY,
        founder_id TEXT NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        stage TEXT NOT NULL,
        skills_needed TEXT DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE applications (
        id TEXT PRIMARY KEY,
        applicant_id TEXT NOT NULL REFERENCES users(id),
        post_type TEXT NOT NULL,
        post_id TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE team_members (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        post_type TEXT NOT NULL,
        post_id TEXT NOT NULL,
        role TEXT DEFAULT 'member',
        joined_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE team_spaces (
        id TEXT PRIMARY KEY,
        post_type TEXT NOT NULL,
        post_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE space_tasks (
        id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL REFERENCES team_spaces(id),
        creator_id TEXT NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        description TEXT,
        completed INTEGER DEFAULT 0,
        completed_by TEXT REFERENCES users(id),
        completed_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Initialize services
    taskService = new TaskService(db);
    builderSpaceService = new BuilderSpaceService(db);
    teamFormationService = new TeamFormationService(db);

    // Create test users
    const now = new Date();
    founderId = crypto.randomUUID();
    applicantId = crypto.randomUUID();

    await db.insert(users).values([
      {
        id: founderId,
        email: 'founder@test.com',
        name: 'Founder User',
        password: 'password123',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: applicantId,
        email: 'applicant@test.com',
        name: 'Applicant User',
        password: 'password123',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Create test startup
    startupId = crypto.randomUUID();
    await db.insert(startups).values({
      id: startupId,
      founderId,
      name: 'Test Startup',
      description: 'A test startup',
      stage: 'Idea',
      createdAt: now,
      updatedAt: now,
    });

    // Create test application
    applicationId = crypto.randomUUID();
    await db.insert(applications).values({
      id: applicationId,
      applicantId,
      postType: 'startup',
      postId: startupId,
      message: 'I want to join',
      status: 'accepted',
      createdAt: now,
      updatedAt: now,
    });

    // Create founder as team member first
    await teamFormationService.createTeamMember(
      founderId,
      'startup',
      startupId,
      'founder'
    );

    // Create team members and Builder Space
    await teamFormationService.inviteToBuilderSpace(applicationId, founderId);

    // Get the created space
    const space = await db
      .select()
      .from(teamSpaces)
      .where(eq(teamSpaces.postId, startupId))
      .limit(1);

    spaceId = space[0].id;
  });

  afterEach(() => {
    sqlite.close();
  });

  describe('createTask', () => {
    it('should create a task with valid parameters', async () => {
      const task = await taskService.createTask({
        spaceId,
        creatorId: founderId,
        title: 'Implement authentication',
        description: 'Add user login and registration',
      });

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.spaceId).toBe(spaceId);
      expect(task.creatorId).toBe(founderId);
      expect(task.creatorName).toBe('Founder User');
      expect(task.title).toBe('Implement authentication');
      expect(task.description).toBe('Add user login and registration');
      expect(task.completed).toBe(false);
      expect(task.completedBy).toBeUndefined();
      expect(task.completedAt).toBeUndefined();
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a task without description', async () => {
      const task = await taskService.createTask({
        spaceId,
        creatorId: applicantId,
        title: 'Setup database',
      });

      expect(task).toBeDefined();
      expect(task.title).toBe('Setup database');
      expect(task.description).toBeUndefined();
      expect(task.creatorName).toBe('Applicant User');
    });

    it('should trim whitespace from title and description', async () => {
      const task = await taskService.createTask({
        spaceId,
        creatorId: founderId,
        title: '  Design UI mockups  ',
        description: '  Create wireframes for main pages  ',
      });

      expect(task.title).toBe('Design UI mockups');
      expect(task.description).toBe('Create wireframes for main pages');
    });

    it('should throw error if Builder Space not found', async () => {
      await expect(
        taskService.createTask({
          spaceId: 'non-existent-space',
          creatorId: founderId,
          title: 'Test task',
        })
      ).rejects.toThrow('Builder Space not found');
    });

    it('should throw error if user is not a team member', async () => {
      const nonMemberId = crypto.randomUUID();
      const now = new Date();

      await db.insert(users).values({
        id: nonMemberId,
        email: 'nonmember@test.com',
        name: 'Non Member',
        password: 'password123',
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        taskService.createTask({
          spaceId,
          creatorId: nonMemberId,
          title: 'Unauthorized task',
        })
      ).rejects.toThrow('Access denied: You are not authorized to create tasks in this Builder Space');
    });

    it('should throw error if title is empty', async () => {
      await expect(
        taskService.createTask({
          spaceId,
          creatorId: founderId,
          title: '',
        })
      ).rejects.toThrow('Title cannot be empty');
    });

    it('should throw error if title is only whitespace', async () => {
      await expect(
        taskService.createTask({
          spaceId,
          creatorId: founderId,
          title: '   ',
        })
      ).rejects.toThrow('Title cannot be empty');
    });

    it('should throw error if title exceeds 200 characters', async () => {
      const longTitle = 'a'.repeat(201);

      await expect(
        taskService.createTask({
          spaceId,
          creatorId: founderId,
          title: longTitle,
        })
      ).rejects.toThrow('Title cannot exceed 200 characters');
    });

    it('should throw error if description exceeds 1000 characters', async () => {
      const longDescription = 'a'.repeat(1001);

      await expect(
        taskService.createTask({
          spaceId,
          creatorId: founderId,
          title: 'Valid title',
          description: longDescription,
        })
      ).rejects.toThrow('Description cannot exceed 1000 characters');
    });

    it('should throw error if creator not found', async () => {
      await expect(
        taskService.createTask({
          spaceId,
          creatorId: 'non-existent-user',
          title: 'Test task',
        })
      ).rejects.toThrow('Access denied: You are not authorized to create tasks in this Builder Space');
    });
  });

  describe('updateTaskStatus', () => {
    let taskId: string;

    beforeEach(async () => {
      const task = await taskService.createTask({
        spaceId,
        creatorId: founderId,
        title: 'Test task for status update',
      });
      taskId = task.id;
    });

    it('should mark task as completed', async () => {
      const updatedTask = await taskService.updateTaskStatus({
        taskId,
        userId: applicantId,
        completed: true,
      });

      expect(updatedTask.completed).toBe(true);
      expect(updatedTask.completedBy).toBe(applicantId);
      expect(updatedTask.completedByName).toBe('Applicant User');
      expect(updatedTask.completedAt).toBeInstanceOf(Date);
      expect(updatedTask.updatedAt).toBeInstanceOf(Date);
    });

    it('should mark task as incomplete', async () => {
      // First mark as completed
      await taskService.updateTaskStatus({
        taskId,
        userId: applicantId,
        completed: true,
      });

      // Then mark as incomplete
      const updatedTask = await taskService.updateTaskStatus({
        taskId,
        userId: founderId,
        completed: false,
      });

      expect(updatedTask.completed).toBe(false);
      expect(updatedTask.completedBy).toBeUndefined();
      expect(updatedTask.completedByName).toBeUndefined();
      expect(updatedTask.completedAt).toBeUndefined();
    });

    it('should allow different team member to complete task', async () => {
      const updatedTask = await taskService.updateTaskStatus({
        taskId,
        userId: founderId,
        completed: true,
      });

      expect(updatedTask.completedBy).toBe(founderId);
      expect(updatedTask.completedByName).toBe('Founder User');
    });

    it('should throw error if task not found', async () => {
      await expect(
        taskService.updateTaskStatus({
          taskId: 'non-existent-task',
          userId: founderId,
          completed: true,
        })
      ).rejects.toThrow('Task not found');
    });

    it('should throw error if user is not a team member', async () => {
      const nonMemberId = crypto.randomUUID();
      const now = new Date();

      await db.insert(users).values({
        id: nonMemberId,
        email: 'nonmember2@test.com',
        name: 'Non Member 2',
        password: 'password123',
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        taskService.updateTaskStatus({
          taskId,
          userId: nonMemberId,
          completed: true,
        })
      ).rejects.toThrow('Access denied: You are not authorized to update tasks in this Builder Space');
    });

    it('should throw error if user not found', async () => {
      await expect(
        taskService.updateTaskStatus({
          taskId,
          userId: 'non-existent-user',
          completed: true,
        })
      ).rejects.toThrow('Access denied: You are not authorized to update tasks in this Builder Space');
    });
  });

  describe('deleteTask', () => {
    let taskId: string;

    beforeEach(async () => {
      const task = await taskService.createTask({
        spaceId,
        creatorId: founderId,
        title: 'Test task for deletion',
      });
      taskId = task.id;
    });

    it('should delete task by creator', async () => {
      await taskService.deleteTask(taskId, founderId);

      // Verify task is deleted
      const tasks = await db
        .select()
        .from(spaceTasks)
        .where(eq(spaceTasks.id, taskId));

      expect(tasks.length).toBe(0);
    });

    it('should throw error if task not found', async () => {
      await expect(
        taskService.deleteTask('non-existent-task', founderId)
      ).rejects.toThrow('Task not found');
    });

    it('should throw error if user is not the creator', async () => {
      await expect(
        taskService.deleteTask(taskId, applicantId)
      ).rejects.toThrow('Access denied: Only the task creator can delete this task');
    });

    it('should throw error if creator is no longer a team member', async () => {
      // Remove founder from team
      await db
        .delete(teamMembers)
        .where(eq(teamMembers.userId, founderId));

      await expect(
        taskService.deleteTask(taskId, founderId)
      ).rejects.toThrow('Access denied: You are not a team member');
    });
  });

  describe('getTasks', () => {
    beforeEach(async () => {
      // Create multiple tasks
      await taskService.createTask({
        spaceId,
        creatorId: founderId,
        title: 'Task 1',
        description: 'First task',
      });

      await taskService.createTask({
        spaceId,
        creatorId: applicantId,
        title: 'Task 2',
      });

      const task3 = await taskService.createTask({
        spaceId,
        creatorId: founderId,
        title: 'Task 3',
        description: 'Third task',
      });

      // Mark one task as completed
      await taskService.updateTaskStatus({
        taskId: task3.id,
        userId: applicantId,
        completed: true,
      });
    });

    it('should retrieve all tasks for a Builder Space', async () => {
      const tasks = await taskService.getTasks(spaceId, founderId);

      expect(tasks.length).toBe(3);
      expect(tasks[0].title).toBe('Task 1');
      expect(tasks[1].title).toBe('Task 2');
      expect(tasks[2].title).toBe('Task 3');
    });

    it('should include creator information', async () => {
      const tasks = await taskService.getTasks(spaceId, founderId);

      expect(tasks[0].creatorName).toBe('Founder User');
      expect(tasks[1].creatorName).toBe('Applicant User');
    });

    it('should include completion information', async () => {
      const tasks = await taskService.getTasks(spaceId, founderId);

      const completedTask = tasks.find(t => t.title === 'Task 3');
      expect(completedTask?.completed).toBe(true);
      expect(completedTask?.completedBy).toBe(applicantId);
      expect(completedTask?.completedByName).toBe('Applicant User');
      expect(completedTask?.completedAt).toBeInstanceOf(Date);
    });

    it('should return empty array if no tasks exist', async () => {
      // Create a new space with no tasks
      const newStartupId = crypto.randomUUID();
      const now = new Date();

      await db.insert(startups).values({
        id: newStartupId,
        founderId,
        name: 'New Startup',
        description: 'Another startup',
        stage: 'Idea',
        createdAt: now,
        updatedAt: now,
      });

      // Add founder as team member first
      await teamFormationService.createTeamMember(
        founderId,
        'startup',
        newStartupId,
        'founder'
      );

      const newSpace = await builderSpaceService.createBuilderSpace(
        'startup',
        newStartupId,
        'New Startup Builder Space'
      );

      const tasks = await taskService.getTasks(newSpace.id, founderId);
      expect(tasks.length).toBe(0);
    });

    it('should throw error if Builder Space not found', async () => {
      await expect(
        taskService.getTasks('non-existent-space', founderId)
      ).rejects.toThrow('Builder Space not found');
    });

    it('should throw error if user is not a team member', async () => {
      const nonMemberId = crypto.randomUUID();
      const now = new Date();

      await db.insert(users).values({
        id: nonMemberId,
        email: 'nonmember3@test.com',
        name: 'Non Member 3',
        password: 'password123',
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        taskService.getTasks(spaceId, nonMemberId)
      ).rejects.toThrow('Access denied: You are not authorized to view tasks in this Builder Space');
    });
  });

  describe('getTask', () => {
    let taskId: string;

    beforeEach(async () => {
      const task = await taskService.createTask({
        spaceId,
        creatorId: founderId,
        title: 'Single task',
        description: 'Task description',
      });
      taskId = task.id;

      // Mark as completed
      await taskService.updateTaskStatus({
        taskId: task.id,
        userId: applicantId,
        completed: true,
      });
    });

    it('should retrieve a specific task by ID', async () => {
      const task = await taskService.getTask(taskId, founderId);

      expect(task.id).toBe(taskId);
      expect(task.title).toBe('Single task');
      expect(task.description).toBe('Task description');
      expect(task.creatorName).toBe('Founder User');
      expect(task.completed).toBe(true);
      expect(task.completedByName).toBe('Applicant User');
    });

    it('should throw error if task not found', async () => {
      await expect(
        taskService.getTask('non-existent-task', founderId)
      ).rejects.toThrow('Task not found');
    });

    it('should throw error if user is not a team member', async () => {
      const nonMemberId = crypto.randomUUID();
      const now = new Date();

      await db.insert(users).values({
        id: nonMemberId,
        email: 'nonmember4@test.com',
        name: 'Non Member 4',
        password: 'password123',
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        taskService.getTask(taskId, nonMemberId)
      ).rejects.toThrow('Access denied: You are not authorized to view this task');
    });
  });

  describe('getTaskCount', () => {
    beforeEach(async () => {
      // Create tasks with different completion statuses
      await taskService.createTask({
        spaceId,
        creatorId: founderId,
        title: 'Task 1',
      });

      const task2 = await taskService.createTask({
        spaceId,
        creatorId: founderId,
        title: 'Task 2',
      });

      const task3 = await taskService.createTask({
        spaceId,
        creatorId: applicantId,
        title: 'Task 3',
      });

      // Mark two tasks as completed
      await taskService.updateTaskStatus({
        taskId: task2.id,
        userId: founderId,
        completed: true,
      });

      await taskService.updateTaskStatus({
        taskId: task3.id,
        userId: applicantId,
        completed: true,
      });
    });

    it('should return correct task counts', async () => {
      const counts = await taskService.getTaskCount(spaceId, founderId);

      expect(counts.total).toBe(3);
      expect(counts.completed).toBe(2);
      expect(counts.incomplete).toBe(1);
    });

    it('should return zero counts for empty space', async () => {
      const newStartupId = crypto.randomUUID();
      const now = new Date();

      await db.insert(startups).values({
        id: newStartupId,
        founderId,
        name: 'Empty Startup',
        description: 'No tasks here',
        stage: 'Idea',
        createdAt: now,
        updatedAt: now,
      });

      // Add founder as team member first
      await teamFormationService.createTeamMember(
        founderId,
        'startup',
        newStartupId,
        'founder'
      );

      const newSpace = await builderSpaceService.createBuilderSpace(
        'startup',
        newStartupId,
        'Empty Builder Space'
      );

      const counts = await taskService.getTaskCount(newSpace.id, founderId);

      expect(counts.total).toBe(0);
      expect(counts.completed).toBe(0);
      expect(counts.incomplete).toBe(0);
    });

    it('should throw error if Builder Space not found', async () => {
      await expect(
        taskService.getTaskCount('non-existent-space', founderId)
      ).rejects.toThrow('Builder Space not found');
    });

    it('should throw error if user is not a team member', async () => {
      const nonMemberId = crypto.randomUUID();
      const now = new Date();

      await db.insert(users).values({
        id: nonMemberId,
        email: 'nonmember5@test.com',
        name: 'Non Member 5',
        password: 'password123',
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        taskService.getTaskCount(spaceId, nonMemberId)
      ).rejects.toThrow('Access denied: You are not authorized to view this Builder Space');
    });
  });
});
