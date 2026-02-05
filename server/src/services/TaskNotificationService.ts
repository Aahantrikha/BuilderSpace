import { db as defaultDb, spaceTasks, teamMembers, users } from '../db/index.js';
import { eq, and, desc } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { messageBroadcastService, MessageType } from './MessageBroadcastService.js';

/**
 * Task change event types
 */
export enum TaskEventType {
  CREATED = 'created',
  UPDATED = 'updated',
  COMPLETED = 'completed',
  UNCOMPLETED = 'uncompleted',
  DELETED = 'deleted',
  ASSIGNED = 'assigned',
}

/**
 * Task change history entry
 */
export interface TaskHistoryEntry {
  id: string;
  taskId: string;
  eventType: TaskEventType;
  userId: string;
  userName: string;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  timestamp: Date;
}

/**
 * Task notification payload
 */
export interface TaskNotification {
  taskId: string;
  spaceId: string;
  eventType: TaskEventType;
  actor: {
    id: string;
    name: string;
  };
  task: {
    title: string;
    description?: string;
    completed: boolean;
    completedBy?: string;
    completedByName?: string;
  };
  timestamp: Date;
}

/**
 * Task assignment information
 */
export interface TaskAssignment {
  taskId: string;
  assignedTo?: string;
  assignedToName?: string;
  assignedBy?: string;
  assignedByName?: string;
  assignedAt?: Date;
}

/**
 * Task ownership information
 */
export interface TaskOwnership {
  taskId: string;
  creatorId: string;
  creatorName: string;
  createdAt: Date;
  canDelete: boolean;
  canEdit: boolean;
}

/**
 * TaskNotificationService manages task-specific notifications and tracking
 * 
 * Features:
 * - Task change notifications to team members
 * - Task completion tracking and history
 * - Task assignment and ownership management
 * - Task activity monitoring
 * 
 * Requirements: 7.3, 7.4
 */
export class TaskNotificationService {
  private db: BetterSQLite3Database<any>;
  private taskHistory: Map<string, TaskHistoryEntry[]> = new Map();

  constructor(db?: BetterSQLite3Database<any>) {
    this.db = db || defaultDb;
  }

  /**
   * Notify team members of task creation
   * 
   * @param taskId - Task ID
   * @param spaceId - Builder Space ID
   * @param creatorId - Creator user ID
   * @param taskData - Task data
   */
  async notifyTaskCreated(
    taskId: string,
    spaceId: string,
    creatorId: string,
    taskData: {
      title: string;
      description?: string;
    }
  ): Promise<void> {
    // Get creator information
    const creator = await this.db
      .select()
      .from(users)
      .where(eq(users.id, creatorId))
      .limit(1);

    if (!creator.length) {
      throw new Error('Creator not found');
    }

    // Create notification payload
    const notification: TaskNotification = {
      taskId,
      spaceId,
      eventType: TaskEventType.CREATED,
      actor: {
        id: creatorId,
        name: creator[0].name,
      },
      task: {
        title: taskData.title,
        description: taskData.description,
        completed: false,
      },
      timestamp: new Date(),
    };

    // Record in history
    this.recordTaskHistory(taskId, {
      id: crypto.randomUUID(),
      taskId,
      eventType: TaskEventType.CREATED,
      userId: creatorId,
      userName: creator[0].name,
      timestamp: notification.timestamp,
    });

    // Broadcast to team members (excluding creator)
    await messageBroadcastService.broadcastGroupMessage(
      spaceId,
      {
        type: MessageType.TASK_CREATED,
        payload: notification,
        timestamp: notification.timestamp,
        senderId: creatorId,
      },
      creatorId
    );
  }

  /**
   * Notify team members of task status update
   * 
   * @param taskId - Task ID
   * @param spaceId - Builder Space ID
   * @param userId - User who updated the task
   * @param completed - New completion status
   * @param taskData - Task data
   */
  async notifyTaskStatusChanged(
    taskId: string,
    spaceId: string,
    userId: string,
    completed: boolean,
    taskData: {
      title: string;
      description?: string;
      completedBy?: string;
      completedByName?: string;
    }
  ): Promise<void> {
    // Get user information
    const user = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length) {
      throw new Error('User not found');
    }

    // Determine event type
    const eventType = completed ? TaskEventType.COMPLETED : TaskEventType.UNCOMPLETED;

    // Create notification payload
    const notification: TaskNotification = {
      taskId,
      spaceId,
      eventType,
      actor: {
        id: userId,
        name: user[0].name,
      },
      task: {
        title: taskData.title,
        description: taskData.description,
        completed,
        completedBy: taskData.completedBy,
        completedByName: taskData.completedByName,
      },
      timestamp: new Date(),
    };

    // Record in history
    this.recordTaskHistory(taskId, {
      id: crypto.randomUUID(),
      taskId,
      eventType,
      userId,
      userName: user[0].name,
      changes: [
        {
          field: 'completed',
          oldValue: !completed,
          newValue: completed,
        },
      ],
      timestamp: notification.timestamp,
    });

    // Broadcast to team members (excluding updater)
    await messageBroadcastService.broadcastGroupMessage(
      spaceId,
      {
        type: MessageType.TASK_UPDATED,
        payload: notification,
        timestamp: notification.timestamp,
        senderId: userId,
      },
      userId
    );
  }

  /**
   * Notify team members of task deletion
   * 
   * @param taskId - Task ID
   * @param spaceId - Builder Space ID
   * @param userId - User who deleted the task
   * @param taskTitle - Title of deleted task
   */
  async notifyTaskDeleted(
    taskId: string,
    spaceId: string,
    userId: string,
    taskTitle: string
  ): Promise<void> {
    // Get user information
    const user = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length) {
      throw new Error('User not found');
    }

    // Create notification payload
    const notification: TaskNotification = {
      taskId,
      spaceId,
      eventType: TaskEventType.DELETED,
      actor: {
        id: userId,
        name: user[0].name,
      },
      task: {
        title: taskTitle,
        completed: false,
      },
      timestamp: new Date(),
    };

    // Record in history
    this.recordTaskHistory(taskId, {
      id: crypto.randomUUID(),
      taskId,
      eventType: TaskEventType.DELETED,
      userId,
      userName: user[0].name,
      timestamp: notification.timestamp,
    });

    // Broadcast to team members (excluding deleter)
    await messageBroadcastService.broadcastGroupMessage(
      spaceId,
      {
        type: MessageType.TASK_DELETED,
        payload: notification,
        timestamp: notification.timestamp,
        senderId: userId,
      },
      userId
    );
  }

  /**
   * Record task change in history
   * 
   * @param taskId - Task ID
   * @param entry - History entry
   */
  private recordTaskHistory(taskId: string, entry: TaskHistoryEntry): void {
    if (!this.taskHistory.has(taskId)) {
      this.taskHistory.set(taskId, []);
    }

    const history = this.taskHistory.get(taskId)!;
    history.push(entry);

    // Keep only last 100 entries per task
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Get task change history
   * 
   * @param taskId - Task ID
   * @returns Array of history entries in chronological order
   */
  getTaskHistory(taskId: string): TaskHistoryEntry[] {
    return this.taskHistory.get(taskId) || [];
  }

  /**
   * Get task completion history for a Builder Space
   * Returns all completion events in chronological order
   * 
   * @param spaceId - Builder Space ID
   * @returns Array of completion history entries
   */
  async getCompletionHistory(spaceId: string): Promise<TaskHistoryEntry[]> {
    const allHistory: TaskHistoryEntry[] = [];

    // Get all tasks for this space
    const tasks = await this.db
      .select()
      .from(spaceTasks)
      .where(eq(spaceTasks.spaceId, spaceId));

    // Collect completion events from history
    for (const task of tasks) {
      const history = this.getTaskHistory(task.id);
      const completionEvents = history.filter(
        entry => entry.eventType === TaskEventType.COMPLETED || 
                 entry.eventType === TaskEventType.UNCOMPLETED
      );
      allHistory.push(...completionEvents);
    }

    // Sort by timestamp (most recent first)
    return allHistory.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get task ownership information
   * 
   * @param taskId - Task ID
   * @param userId - User ID requesting ownership info
   * @returns Task ownership information
   */
  async getTaskOwnership(taskId: string, userId: string): Promise<TaskOwnership> {
    // Get the task
    const task = await this.db
      .select()
      .from(spaceTasks)
      .where(eq(spaceTasks.id, taskId))
      .limit(1);

    if (!task.length) {
      throw new Error('Task not found');
    }

    // Get creator information
    const creator = await this.db
      .select()
      .from(users)
      .where(eq(users.id, task[0].creatorId))
      .limit(1);

    if (!creator.length) {
      throw new Error('Creator not found');
    }

    // Determine permissions
    const isCreator = task[0].creatorId === userId;

    return {
      taskId,
      creatorId: task[0].creatorId,
      creatorName: creator[0].name,
      createdAt: task[0].createdAt || new Date(),
      canDelete: isCreator, // Only creator can delete
      canEdit: true, // All team members can edit (toggle completion)
    };
  }

  /**
   * Get task assignment information
   * Note: Current implementation uses completedBy as implicit assignment
   * Future enhancement could add explicit assignment field
   * 
   * @param taskId - Task ID
   * @returns Task assignment information
   */
  async getTaskAssignment(taskId: string): Promise<TaskAssignment> {
    // Get the task
    const task = await this.db
      .select()
      .from(spaceTasks)
      .where(eq(spaceTasks.id, taskId))
      .limit(1);

    if (!task.length) {
      throw new Error('Task not found');
    }

    // If task is completed, treat completedBy as assignment
    if (task[0].completed && task[0].completedBy) {
      const assignedUser = await this.db
        .select()
        .from(users)
        .where(eq(users.id, task[0].completedBy))
        .limit(1);

      return {
        taskId,
        assignedTo: task[0].completedBy,
        assignedToName: assignedUser.length > 0 ? assignedUser[0].name : 'Unknown User',
        assignedAt: task[0].completedAt || undefined,
      };
    }

    // No explicit assignment
    return {
      taskId,
    };
  }

  /**
   * Get task activity summary for a Builder Space
   * 
   * @param spaceId - Builder Space ID
   * @returns Activity summary with counts
   */
  async getTaskActivitySummary(spaceId: string): Promise<{
    totalTasks: number;
    completedTasks: number;
    incompleteTasks: number;
    recentActivity: TaskHistoryEntry[];
  }> {
    // Get all tasks for this space
    const tasks = await this.db
      .select()
      .from(spaceTasks)
      .where(eq(spaceTasks.spaceId, spaceId));

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;
    const incompleteTasks = totalTasks - completedTasks;

    // Get recent activity from history
    const allHistory: TaskHistoryEntry[] = [];
    for (const task of tasks) {
      const history = this.getTaskHistory(task.id);
      allHistory.push(...history);
    }

    // Sort by timestamp (most recent first) and take last 10
    const recentActivity = allHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return {
      totalTasks,
      completedTasks,
      incompleteTasks,
      recentActivity,
    };
  }

  /**
   * Get tasks completed by a specific user in a Builder Space
   * 
   * @param spaceId - Builder Space ID
   * @param userId - User ID
   * @returns Array of completed tasks
   */
  async getTasksCompletedByUser(spaceId: string, userId: string): Promise<any[]> {
    const tasks = await this.db
      .select()
      .from(spaceTasks)
      .where(
        and(
          eq(spaceTasks.spaceId, spaceId),
          eq(spaceTasks.completed, true),
          eq(spaceTasks.completedBy, userId)
        )
      )
      .orderBy(desc(spaceTasks.completedAt));

    return tasks;
  }

  /**
   * Get tasks created by a specific user in a Builder Space
   * 
   * @param spaceId - Builder Space ID
   * @param userId - User ID
   * @returns Array of created tasks
   */
  async getTasksCreatedByUser(spaceId: string, userId: string): Promise<any[]> {
    const tasks = await this.db
      .select()
      .from(spaceTasks)
      .where(
        and(
          eq(spaceTasks.spaceId, spaceId),
          eq(spaceTasks.creatorId, userId)
        )
      )
      .orderBy(desc(spaceTasks.createdAt));

    return tasks;
  }

  /**
   * Clear task history (useful for testing)
   * 
   * @param taskId - Optional task ID to clear specific task history
   */
  clearHistory(taskId?: string): void {
    if (taskId) {
      this.taskHistory.delete(taskId);
    } else {
      this.taskHistory.clear();
    }
  }
}

export const taskNotificationService = new TaskNotificationService();
