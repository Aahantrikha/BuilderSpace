import { SpaceTask, TeamSpace, User } from '../db/index.js';
import { BuilderSpaceService } from './BuilderSpaceService.js';
import { messageBroadcastService, MessageType } from './MessageBroadcastService.js';

export interface SpaceTask {
  id: string;
  spaceId: string;
  creatorId: string;
  creatorName: string;
  title: string;
  description?: string;
  completed: boolean;
  completedBy?: string;
  completedByName?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskParams {
  spaceId: string;
  creatorId: string;
  title: string;
  description?: string;
}

export interface UpdateTaskStatusParams {
  taskId: string;
  userId: string;
  completed: boolean;
}

/**
 * TaskService manages task lifecycle operations within Builder Spaces
 * 
 * Features:
 * - Create tasks with team member validation
 * - Update task completion status with tracking
 * - Delete tasks with creator authorization
 * - Real-time notifications for task changes
 * 
 * Requirements: 7.1, 7.2, 7.5
 */
export class TaskService {
  private builderSpaceService: BuilderSpaceService;

  constructor() {
    this.builderSpaceService = new BuilderSpaceService();
  }

  /**
   * Validate and sanitize title
   * 
   * @param title - The title to validate
   * @returns Sanitized title
   * @throws Error if title is invalid
   */
  private validateTitle(title: string): string {
    const trimmed = title.trim();

    if (!trimmed) {
      throw new Error('Title cannot be empty');
    }

    if (trimmed.length > 200) {
      throw new Error('Title cannot exceed 200 characters');
    }

    return trimmed;
  }

  /**
   * Validate and sanitize description
   * 
   * @param description - The description to validate
   * @returns Sanitized description or undefined
   */
  private validateDescription(description?: string): string | undefined {
    if (!description) {
      return undefined;
    }

    const trimmed = description.trim();

    if (!trimmed) {
      return undefined;
    }

    if (trimmed.length > 1000) {
      throw new Error('Description cannot exceed 1000 characters');
    }

    return trimmed;
  }

  /**
   * Create a task in a Builder Space
   * Validates team member authorization before creating
   * 
   * @param params - Task parameters including spaceId, creatorId, title, and optional description
   * @returns The created task with creator information
   * @throws Error if unauthorized or validation fails
   */
  async createTask(params: CreateTaskParams): Promise<SpaceTask> {
    const { spaceId, creatorId, title, description } = params;

    // Get the space to validate it exists and get post info
    const space = await TeamSpace.findById(spaceId);

    if (!space) {
      throw new Error('Builder Space not found');
    }

    // Validate authorization - only team members can create tasks
    const isAuthorized = await this.builderSpaceService.validateTeamMemberAccess(
      creatorId,
      space.postType as 'startup' | 'hackathon',
      space.postId
    );

    if (!isAuthorized) {
      throw new Error('Access denied: You are not authorized to create tasks in this Builder Space');
    }

    // Validate and sanitize title
    const sanitizedTitle = this.validateTitle(title);

    // Validate and sanitize description
    const sanitizedDescription = this.validateDescription(description);

    // Get creator information
    const creator = await User.findById(creatorId);

    if (!creator) {
      throw new Error('Creator not found');
    }

    // Create task
    const task = await SpaceTask.create({
      spaceId,
      creatorId,
      title: sanitizedTitle,
      description: sanitizedDescription,
      completed: false,
    });

    const taskData: SpaceTask = {
      id: task.id,
      spaceId,
      creatorId,
      creatorName: creator.name,
      title: sanitizedTitle,
      description: sanitizedDescription,
      completed: false,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };

    // Broadcast task creation to all team members in real-time (excluding creator)
    await messageBroadcastService.broadcastGroupMessage(
      spaceId,
      {
        type: MessageType.TASK_CREATED,
        payload: taskData,
        timestamp: task.createdAt,
        senderId: creatorId,
      },
      creatorId // Exclude creator from broadcast
    );

    return taskData;
  }

  /**
   * Update task completion status
   * Any team member can mark tasks as completed or incomplete
   * Tracks who completed the task and when
   * 
   * @param params - Update parameters including taskId, userId, and completed status
   * @returns The updated task with completion information
   * @throws Error if unauthorized or task not found
   */
  async updateTaskStatus(params: UpdateTaskStatusParams): Promise<SpaceTask> {
    const { taskId, userId, completed } = params;

    // Get the task
    const task = await this.db
      .select()
      .from(spaceTasks)
      .where(eq(spaceTasks.id, taskId))
      .limit(1);

    if (!task.length) {
      throw new Error('Task not found');
    }

    // Get the space to validate authorization
    const space = await this.db
      .select()
      .from(teamSpaces)
      .where(eq(teamSpaces.id, task[0].spaceId))
      .limit(1);

    if (!space.length) {
      throw new Error('Builder Space not found');
    }

    // Validate authorization - only team members can update task status
    const isAuthorized = await this.builderSpaceService.validateTeamMemberAccess(
      userId,
      space[0].postType as 'startup' | 'hackathon',
      space[0].postId
    );

    if (!isAuthorized) {
      throw new Error('Access denied: You are not authorized to update tasks in this Builder Space');
    }

    // Get user information
    const user = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length) {
      throw new Error('User not found');
    }

    // Update task status
    const now = new Date();
    const updateValues: any = {
      completed,
      updatedAt: now,
    };

    if (completed) {
      // Mark as completed by this user
      updateValues.completedBy = userId;
      updateValues.completedAt = now;
    } else {
      // Mark as incomplete, clear completion info
      updateValues.completedBy = null;
      updateValues.completedAt = null;
    }

    await this.db
      .update(spaceTasks)
      .set(updateValues)
      .where(eq(spaceTasks.id, taskId));

    // Get creator information for the response
    const creator = await this.db
      .select()
      .from(users)
      .where(eq(users.id, task[0].creatorId))
      .limit(1);

    const updatedTask: SpaceTask = {
      id: task[0].id,
      spaceId: task[0].spaceId,
      creatorId: task[0].creatorId,
      creatorName: creator.length > 0 ? creator[0].name : 'Unknown User',
      title: task[0].title,
      description: task[0].description || undefined,
      completed,
      completedBy: completed ? userId : undefined,
      completedByName: completed ? user[0].name : undefined,
      completedAt: completed ? now : undefined,
      createdAt: task[0].createdAt || new Date(),
      updatedAt: now,
    };

    // Broadcast task update to all team members in real-time (excluding updater)
    await messageBroadcastService.broadcastGroupMessage(
      task[0].spaceId,
      {
        type: MessageType.TASK_UPDATED,
        payload: updatedTask,
        timestamp: now,
        senderId: userId,
      },
      userId // Exclude updater from broadcast
    );

    // If task was just completed, send a chat message notification
    if (completed && !task[0].completed) {
      const { groupChatService } = await import('./GroupChatService.js');
      try {
        await groupChatService.sendGroupMessage({
          spaceId: task[0].spaceId,
          senderId: userId,
          content: `✅ Completed task: "${task[0].title}"`,
        });
      } catch (error) {
        console.error('Failed to send task completion message:', error);
        // Don't fail the task update if chat message fails
      }
    }

    return updatedTask;
  }

  /**
   * Delete a task from a Builder Space
   * Only the creator can delete their own tasks
   * 
   * @param taskId - The ID of the task to delete
   * @param userId - The ID of the user requesting deletion
   * @throws Error if unauthorized or task not found
   */
  async deleteTask(taskId: string, userId: string): Promise<void> {
    // Get the task
    const task = await this.db
      .select()
      .from(spaceTasks)
      .where(eq(spaceTasks.id, taskId))
      .limit(1);

    if (!task.length) {
      throw new Error('Task not found');
    }

    // Validate creator authorization - only creator can delete
    if (task[0].creatorId !== userId) {
      throw new Error('Access denied: Only the task creator can delete this task');
    }

    // Get the space to validate it exists
    const space = await this.db
      .select()
      .from(teamSpaces)
      .where(eq(teamSpaces.id, task[0].spaceId))
      .limit(1);

    if (!space.length) {
      throw new Error('Builder Space not found');
    }

    // Validate user is still a team member
    const isAuthorized = await this.builderSpaceService.validateTeamMemberAccess(
      userId,
      space[0].postType as 'startup' | 'hackathon',
      space[0].postId
    );

    if (!isAuthorized) {
      throw new Error('Access denied: You are not a team member');
    }

    // Delete the task
    await this.db
      .delete(spaceTasks)
      .where(eq(spaceTasks.id, taskId));

    // Broadcast task deletion to all team members in real-time (excluding deleter)
    await messageBroadcastService.broadcastGroupMessage(
      task[0].spaceId,
      {
        type: MessageType.TASK_DELETED,
        payload: { taskId, spaceId: task[0].spaceId },
        timestamp: new Date(),
        senderId: userId,
      },
      userId // Exclude deleter from broadcast
    );
  }

  /**
   * Get all tasks for a Builder Space
   * Only team members can access tasks
   * 
   * @param spaceId - The ID of the Builder Space
   * @param userId - The ID of the user requesting tasks
   * @returns Array of tasks with creator and completion information
   * @throws Error if unauthorized
   */
  async getTasks(spaceId: string, userId: string): Promise<SpaceTask[]> {
    // Get the space to validate it exists and get post info
    const space = await this.db
      .select()
      .from(teamSpaces)
      .where(eq(teamSpaces.id, spaceId))
      .limit(1);

    if (!space.length) {
      throw new Error('Builder Space not found');
    }

    // Validate authorization - only team members can view tasks
    const isAuthorized = await this.builderSpaceService.validateTeamMemberAccess(
      userId,
      space[0].postType as 'startup' | 'hackathon',
      space[0].postId
    );

    if (!isAuthorized) {
      throw new Error('Access denied: You are not authorized to view tasks in this Builder Space');
    }

    // Get tasks with creator and completer information
    const tasks = await this.db
      .select({
        id: spaceTasks.id,
        spaceId: spaceTasks.spaceId,
        creatorId: spaceTasks.creatorId,
        title: spaceTasks.title,
        description: spaceTasks.description,
        completed: spaceTasks.completed,
        completedBy: spaceTasks.completedBy,
        completedAt: spaceTasks.completedAt,
        createdAt: spaceTasks.createdAt,
        updatedAt: spaceTasks.updatedAt,
      })
      .from(spaceTasks)
      .where(eq(spaceTasks.spaceId, spaceId))
      .orderBy(spaceTasks.createdAt); // Chronological order (oldest first)

    // Enrich with user information
    const enrichedTasks: SpaceTask[] = [];
    for (const task of tasks) {
      // Get creator name
      const creator = await this.db
        .select()
        .from(users)
        .where(eq(users.id, task.creatorId))
        .limit(1);

      // Get completer name if task is completed
      let completedByName: string | undefined;
      if (task.completedBy) {
        const completer = await this.db
          .select()
          .from(users)
          .where(eq(users.id, task.completedBy))
          .limit(1);
        completedByName = completer.length > 0 ? completer[0].name : 'Unknown User';
      }

      enrichedTasks.push({
        id: task.id,
        spaceId: task.spaceId,
        creatorId: task.creatorId,
        creatorName: creator.length > 0 ? creator[0].name : 'Unknown User',
        title: task.title,
        description: task.description || undefined,
        completed: task.completed || false,
        completedBy: task.completedBy || undefined,
        completedByName,
        completedAt: task.completedAt || undefined,
        createdAt: task.createdAt || new Date(),
        updatedAt: task.updatedAt || new Date(),
      });
    }

    return enrichedTasks;
  }

  /**
   * Get a specific task by ID
   * Only team members can access the task
   * 
   * @param taskId - The ID of the task
   * @param userId - The ID of the user requesting the task
   * @returns The task with creator and completion information
   * @throws Error if unauthorized or task not found
   */
  async getTask(taskId: string, userId: string): Promise<SpaceTask> {
    // Get the task
    const task = await this.db
      .select()
      .from(spaceTasks)
      .where(eq(spaceTasks.id, taskId))
      .limit(1);

    if (!task.length) {
      throw new Error('Task not found');
    }

    // Get the space to validate authorization
    const space = await this.db
      .select()
      .from(teamSpaces)
      .where(eq(teamSpaces.id, task[0].spaceId))
      .limit(1);

    if (!space.length) {
      throw new Error('Builder Space not found');
    }

    // Validate authorization
    const isAuthorized = await this.builderSpaceService.validateTeamMemberAccess(
      userId,
      space[0].postType as 'startup' | 'hackathon',
      space[0].postId
    );

    if (!isAuthorized) {
      throw new Error('Access denied: You are not authorized to view this task');
    }

    // Get creator information
    const creator = await this.db
      .select()
      .from(users)
      .where(eq(users.id, task[0].creatorId))
      .limit(1);

    // Get completer information if task is completed
    let completedByName: string | undefined;
    if (task[0].completedBy) {
      const completer = await this.db
        .select()
        .from(users)
        .where(eq(users.id, task[0].completedBy))
        .limit(1);
      completedByName = completer.length > 0 ? completer[0].name : 'Unknown User';
    }

    return {
      id: task[0].id,
      spaceId: task[0].spaceId,
      creatorId: task[0].creatorId,
      creatorName: creator.length > 0 ? creator[0].name : 'Unknown User',
      title: task[0].title,
      description: task[0].description || undefined,
      completed: task[0].completed || false,
      completedBy: task[0].completedBy || undefined,
      completedByName,
      completedAt: task[0].completedAt || undefined,
      createdAt: task[0].createdAt || new Date(),
      updatedAt: task[0].updatedAt || new Date(),
    };
  }

  /**
   * Get task count for a Builder Space
   * Useful for displaying task counts or activity indicators
   * 
   * @param spaceId - The ID of the Builder Space
   * @param userId - The ID of the user requesting the count
   * @returns Object with total, completed, and incomplete task counts
   * @throws Error if unauthorized
   */
  async getTaskCount(spaceId: string, userId: string): Promise<{ total: number; completed: number; incomplete: number }> {
    // Get the space to validate it exists and get post info
    const space = await this.db
      .select()
      .from(teamSpaces)
      .where(eq(teamSpaces.id, spaceId))
      .limit(1);

    if (!space.length) {
      throw new Error('Builder Space not found');
    }

    // Validate authorization
    const isAuthorized = await this.builderSpaceService.validateTeamMemberAccess(
      userId,
      space[0].postType as 'startup' | 'hackathon',
      space[0].postId
    );

    if (!isAuthorized) {
      throw new Error('Access denied: You are not authorized to view this Builder Space');
    }

    // Count tasks
    const tasks = await this.db
      .select()
      .from(spaceTasks)
      .where(eq(spaceTasks.spaceId, spaceId));

    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const incomplete = total - completed;

    return { total, completed, incomplete };
  }
}

export const taskService = new TaskService();
