import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { TaskNotificationService, TaskEventType } from './TaskNotificationService.js';
import { users, teamMembers, teamSpaces, spaceTasks } from '../db/schema.js';
import { messageBroadcastService } from './MessageBroadcastService.js';
import { eq } from 'drizzle-orm';

describe('TaskNotificationService', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;
  let service: TaskNotificationService;
  let testUserId: string;
  let testSpaceId: string;
  let testTaskId: string;

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

    service = new TaskNotificationService(db);

    // Create test user
    testUserId = crypto.randomUUID();
    await db.insert(users).values({
      id: testUserId,
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test space
    testSpaceId = crypto.randomUUID();
    await db.insert(teamSpaces).values({
      id: testSpaceId,
      postType: 'startup',
      postId: 'test-post',
      name: 'Test Space',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test task
    testTaskId = crypto.randomUUID();
    await db.insert(spaceTasks).values({
      id: testTaskId,
      spaceId: testSpaceId,
      creatorId: testUserId,
      title: 'Test Task',
      description: 'Test Description',
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Clear history
    service.clearHistory();

    // Mock broadcast service
    vi.spyOn(messageBroadcastService, 'broadcastGroupMessage').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sqlite.close();
  });

  describe('notifyTaskCreated', () => {
    it('should notify team members of task creation', async () => {
      await service.notifyTaskCreated(testTaskId, testSpaceId, testUserId, {
        title: 'New Task',
        description: 'Task description',
      });

      expect(messageBroadcastService.broadcastGroupMessage).toHaveBeenCalledWith(
        testSpaceId,
        expect.objectContaining({
          type: 'task_created',
          payload: expect.objectContaining({
            taskId: testTaskId,
            spaceId: testSpaceId,
            eventType: TaskEventType.CREATED,
          }),
        }),
        testUserId
      );
    });

    it('should record task creation in history', async () => {
      await service.notifyTaskCreated(testTaskId, testSpaceId, testUserId, {
        title: 'New Task',
      });

      const history = service.getTaskHistory(testTaskId);
      expect(history).toHaveLength(1);
      expect(history[0].eventType).toBe(TaskEventType.CREATED);
      expect(history[0].userId).toBe(testUserId);
    });

    it('should throw error if creator not found', async () => {
      await expect(
        service.notifyTaskCreated(testTaskId, testSpaceId, 'invalid-user', {
          title: 'New Task',
        })
      ).rejects.toThrow('Creator not found');
    });
  });

  describe('notifyTaskStatusChanged', () => {
    it('should notify team members of task completion', async () => {
      await service.notifyTaskStatusChanged(
        testTaskId,
        testSpaceId,
        testUserId,
        true,
        {
          title: 'Test Task',
          completedBy: testUserId,
          completedByName: 'Test User',
        }
      );

      expect(messageBroadcastService.broadcastGroupMessage).toHaveBeenCalledWith(
        testSpaceId,
        expect.objectContaining({
          type: 'task_updated',
          payload: expect.objectContaining({
            eventType: TaskEventType.COMPLETED,
          }),
        }),
        testUserId
      );
    });

    it('should notify team members of task uncompleted', async () => {
      await service.notifyTaskStatusChanged(
        testTaskId,
        testSpaceId,
        testUserId,
        false,
        {
          title: 'Test Task',
        }
      );

      expect(messageBroadcastService.broadcastGroupMessage).toHaveBeenCalledWith(
        testSpaceId,
        expect.objectContaining({
          payload: expect.objectContaining({
            eventType: TaskEventType.UNCOMPLETED,
          }),
        }),
        testUserId
      );
    });

    it('should record status change in history', async () => {
      await service.notifyTaskStatusChanged(
        testTaskId,
        testSpaceId,
        testUserId,
        true,
        {
          title: 'Test Task',
        }
      );

      const history = service.getTaskHistory(testTaskId);
      expect(history).toHaveLength(1);
      expect(history[0].eventType).toBe(TaskEventType.COMPLETED);
      expect(history[0].changes).toEqual([
        {
          field: 'completed',
          oldValue: false,
          newValue: true,
        },
      ]);
    });
  });

  describe('notifyTaskDeleted', () => {
    it('should notify team members of task deletion', async () => {
      await service.notifyTaskDeleted(
        testTaskId,
        testSpaceId,
        testUserId,
        'Test Task'
      );

      expect(messageBroadcastService.broadcastGroupMessage).toHaveBeenCalledWith(
        testSpaceId,
        expect.objectContaining({
          type: 'task_deleted',
          payload: expect.objectContaining({
            eventType: TaskEventType.DELETED,
          }),
        }),
        testUserId
      );
    });

    it('should record deletion in history', async () => {
      await service.notifyTaskDeleted(
        testTaskId,
        testSpaceId,
        testUserId,
        'Test Task'
      );

      const history = service.getTaskHistory(testTaskId);
      expect(history).toHaveLength(1);
      expect(history[0].eventType).toBe(TaskEventType.DELETED);
    });
  });

  describe('getTaskHistory', () => {
    it('should return empty array for task with no history', () => {
      const history = service.getTaskHistory('non-existent-task');
      expect(history).toEqual([]);
    });

    it('should return history entries in order', async () => {
      await service.notifyTaskCreated(testTaskId, testSpaceId, testUserId, {
        title: 'Test Task',
      });

      await service.notifyTaskStatusChanged(
        testTaskId,
        testSpaceId,
        testUserId,
        true,
        {
          title: 'Test Task',
        }
      );

      const history = service.getTaskHistory(testTaskId);
      expect(history).toHaveLength(2);
      expect(history[0].eventType).toBe(TaskEventType.CREATED);
      expect(history[1].eventType).toBe(TaskEventType.COMPLETED);
    });
  });

  describe('getCompletionHistory', () => {
    it('should return completion events for a space', async () => {
      await service.notifyTaskStatusChanged(
        testTaskId,
        testSpaceId,
        testUserId,
        true,
        {
          title: 'Test Task',
        }
      );

      const history = await service.getCompletionHistory(testSpaceId);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].eventType).toBe(TaskEventType.COMPLETED);
    });

    it('should return empty array for space with no completion events', async () => {
      const emptySpaceId = crypto.randomUUID();
      await db.insert(teamSpaces).values({
        id: emptySpaceId,
        postType: 'startup',
        postId: 'empty-post',
        name: 'Empty Space',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const history = await service.getCompletionHistory(emptySpaceId);
      expect(history).toEqual([]);
    });
  });

  describe('getTaskOwnership', () => {
    it('should return ownership information for task creator', async () => {
      const ownership = await service.getTaskOwnership(testTaskId, testUserId);

      expect(ownership).toEqual({
        taskId: testTaskId,
        creatorId: testUserId,
        creatorName: 'Test User',
        createdAt: expect.any(Date),
        canDelete: true,
        canEdit: true,
      });
    });

    it('should return ownership information for non-creator', async () => {
      const otherUserId = crypto.randomUUID();
      await db.insert(users).values({
        id: otherUserId,
        email: 'other@example.com',
        name: 'Other User',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const ownership = await service.getTaskOwnership(testTaskId, otherUserId);

      expect(ownership.canDelete).toBe(false);
      expect(ownership.canEdit).toBe(true);
    });

    it('should throw error if task not found', async () => {
      await expect(
        service.getTaskOwnership('invalid-task', testUserId)
      ).rejects.toThrow('Task not found');
    });
  });

  describe('getTaskAssignment', () => {
    it('should return assignment for completed task', async () => {
      // Update task to completed using proper Drizzle syntax
      await db
        .update(spaceTasks)
        .set({
          completed: true,
          completedBy: testUserId,
          completedAt: new Date(),
        })
        .where(eq(spaceTasks.id, testTaskId));

      const assignment = await service.getTaskAssignment(testTaskId);

      expect(assignment).toEqual({
        taskId: testTaskId,
        assignedTo: testUserId,
        assignedToName: 'Test User',
        assignedAt: expect.any(Date),
      });
    });

    it('should return no assignment for incomplete task', async () => {
      const assignment = await service.getTaskAssignment(testTaskId);

      expect(assignment).toEqual({
        taskId: testTaskId,
      });
    });
  });

  describe('getTaskActivitySummary', () => {
    it('should return activity summary for space', async () => {
      // Create another task
      const task2Id = crypto.randomUUID();
      await db.insert(spaceTasks).values({
        id: task2Id,
        spaceId: testSpaceId,
        creatorId: testUserId,
        title: 'Task 2',
        completed: true,
        completedBy: testUserId,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Add some history
      await service.notifyTaskCreated(testTaskId, testSpaceId, testUserId, {
        title: 'Test Task',
      });

      const summary = await service.getTaskActivitySummary(testSpaceId);

      expect(summary.totalTasks).toBe(2);
      expect(summary.completedTasks).toBe(1);
      expect(summary.incompleteTasks).toBe(1);
      expect(summary.recentActivity.length).toBeGreaterThan(0);
    });
  });

  describe('getTasksCompletedByUser', () => {
    it('should return tasks completed by user', async () => {
      // Update task to completed using proper Drizzle syntax
      await db
        .update(spaceTasks)
        .set({
          completed: true,
          completedBy: testUserId,
          completedAt: new Date(),
        })
        .where(eq(spaceTasks.id, testTaskId));

      const tasks = await service.getTasksCompletedByUser(testSpaceId, testUserId);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(testTaskId);
    });

    it('should return empty array if user has not completed any tasks', async () => {
      const otherUserId = crypto.randomUUID();
      const tasks = await service.getTasksCompletedByUser(testSpaceId, otherUserId);

      expect(tasks).toEqual([]);
    });
  });

  describe('getTasksCreatedByUser', () => {
    it('should return tasks created by user', async () => {
      const tasks = await service.getTasksCreatedByUser(testSpaceId, testUserId);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(testTaskId);
    });

    it('should return empty array if user has not created any tasks', async () => {
      const otherUserId = crypto.randomUUID();
      const tasks = await service.getTasksCreatedByUser(testSpaceId, otherUserId);

      expect(tasks).toEqual([]);
    });
  });

  describe('clearHistory', () => {
    it('should clear specific task history', async () => {
      await service.notifyTaskCreated(testTaskId, testSpaceId, testUserId, {
        title: 'Test Task',
      });

      service.clearHistory(testTaskId);

      const history = service.getTaskHistory(testTaskId);
      expect(history).toEqual([]);
    });

    it('should clear all history', async () => {
      await service.notifyTaskCreated(testTaskId, testSpaceId, testUserId, {
        title: 'Test Task',
      });

      service.clearHistory();

      const history = service.getTaskHistory(testTaskId);
      expect(history).toEqual([]);
    });
  });
});
