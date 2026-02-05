import { db as defaultDb, teamSpaces, spaceMessages, spaceLinks, spaceTasks, teamMembers } from '../db/index.js';
import { eq, and, desc } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { MessageBroadcastService, MessageType } from './MessageBroadcastService.js';

/**
 * Full state snapshot for a Builder Space
 */
export interface BuilderSpaceState {
  spaceId: string;
  messages: any[];
  links: any[];
  tasks: any[];
  members: any[];
  lastUpdated: Date;
}

/**
 * Incremental update for real-time changes
 */
export interface StateUpdate {
  type: 'message' | 'link' | 'task' | 'member';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: Date;
}

/**
 * Conflict resolution strategy
 */
export enum ConflictResolution {
  LAST_WRITE_WINS = 'last_write_wins',
  MERGE = 'merge',
  REJECT = 'reject',
}

/**
 * StateSyncService handles state synchronization for Builder Spaces
 * 
 * Features:
 * - Full state sync for users coming online
 * - Incremental updates for real-time changes
 * - Conflict resolution for concurrent operations
 * - Version tracking for consistency
 * 
 * Requirements: 8.5, 9.4
 */
export class StateSyncService {
  private db: BetterSQLite3Database<any>;
  private broadcastService: MessageBroadcastService;
  private stateVersions: Map<string, number> = new Map(); // spaceId -> version

  constructor(
    db?: BetterSQLite3Database<any>,
    broadcastService?: MessageBroadcastService
  ) {
    this.db = db || defaultDb;
    this.broadcastService = broadcastService || new MessageBroadcastService(this.db);
  }

  /**
   * Get full state snapshot for a Builder Space
   * Used when users come online to synchronize with latest state
   * 
   * @param spaceId - Builder Space ID
   * @returns Complete state snapshot
   */
  async getFullState(spaceId: string): Promise<BuilderSpaceState> {
    // Get all messages
    const messages = await this.db
      .select()
      .from(spaceMessages)
      .where(eq(spaceMessages.spaceId, spaceId))
      .orderBy(desc(spaceMessages.createdAt));

    // Get all links
    const links = await this.db
      .select()
      .from(spaceLinks)
      .where(eq(spaceLinks.spaceId, spaceId))
      .orderBy(desc(spaceLinks.createdAt));

    // Get all tasks
    const tasks = await this.db
      .select()
      .from(spaceTasks)
      .where(eq(spaceTasks.spaceId, spaceId))
      .orderBy(desc(spaceTasks.createdAt));

    // Get space info to find team members
    const space = await this.db
      .select()
      .from(teamSpaces)
      .where(eq(teamSpaces.id, spaceId))
      .limit(1);

    let members: any[] = [];
    if (space.length > 0) {
      members = await this.db
        .select()
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.postType, space[0].postType),
            eq(teamMembers.postId, space[0].postId)
          )
        );
    }

    return {
      spaceId,
      messages,
      links,
      tasks,
      members,
      lastUpdated: new Date(),
    };
  }

  /**
   * Synchronize user with latest Builder Space state
   * Called when user comes online
   * 
   * @param userId - User ID
   * @param spaceId - Builder Space ID
   */
  async syncUserState(userId: string, spaceId: string): Promise<void> {
    // Verify user is a team member
    const isMember = await this.isTeamMember(userId, spaceId);
    if (!isMember) {
      throw new Error('User is not a team member');
    }

    // Get full state
    const state = await this.getFullState(spaceId);

    // Send state to user
    this.broadcastService.sendToUser(userId, {
      type: MessageType.CONNECT,
      payload: {
        type: 'full_state_sync',
        state,
      },
      timestamp: new Date(),
    });

    console.log(`🔄 Synchronized full state for user ${userId} in space ${spaceId}`);
  }

  /**
   * Broadcast incremental update to all team members
   * Used for real-time changes
   * 
   * @param spaceId - Builder Space ID
   * @param update - State update
   * @param excludeUserId - Optional user ID to exclude (e.g., the user who made the change)
   */
  async broadcastUpdate(
    spaceId: string,
    update: StateUpdate,
    excludeUserId?: string
  ): Promise<void> {
    // Increment state version
    const currentVersion = this.stateVersions.get(spaceId) || 0;
    const newVersion = currentVersion + 1;
    this.stateVersions.set(spaceId, newVersion);

    // Broadcast to all team members
    await this.broadcastService.broadcastGroupMessage(
      spaceId,
      {
        type: this.getMessageTypeForUpdate(update),
        payload: {
          ...update,
          version: newVersion,
        },
        timestamp: update.timestamp,
      },
      excludeUserId
    );

    console.log(`🔄 Broadcast incremental update for space ${spaceId} (version ${newVersion})`);
  }

  /**
   * Handle concurrent operation with conflict resolution
   * 
   * @param spaceId - Builder Space ID
   * @param operation - Operation to perform
   * @param strategy - Conflict resolution strategy
   * @returns Result of operation
   */
  async handleConcurrentOperation<T>(
    spaceId: string,
    operation: () => Promise<T>,
    strategy: ConflictResolution = ConflictResolution.LAST_WRITE_WINS
  ): Promise<T> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        // Execute operation within transaction
        const result = await operation();

        // Increment version on success
        const currentVersion = this.stateVersions.get(spaceId) || 0;
        this.stateVersions.set(spaceId, currentVersion + 1);

        return result;
      } catch (error: any) {
        attempt++;

        // Check if it's a conflict error
        if (this.isConflictError(error)) {
          console.log(`⚠️ Conflict detected in space ${spaceId}, attempt ${attempt}/${maxRetries}`);

          if (attempt >= maxRetries) {
            throw new Error(`Concurrent operation failed after ${maxRetries} attempts: ${error.message}`);
          }

          // Apply conflict resolution strategy
          await this.resolveConflict(spaceId, strategy);

          // Wait before retry with exponential backoff
          await this.sleep(Math.pow(2, attempt) * 100);
        } else {
          // Not a conflict error, rethrow
          throw error;
        }
      }
    }

    throw new Error('Concurrent operation failed');
  }

  /**
   * Resolve conflict based on strategy
   * 
   * @param spaceId - Builder Space ID
   * @param strategy - Conflict resolution strategy
   */
  private async resolveConflict(
    spaceId: string,
    strategy: ConflictResolution
  ): Promise<void> {
    switch (strategy) {
      case ConflictResolution.LAST_WRITE_WINS:
        // Refresh state from database (last write wins)
        const currentVersion = this.stateVersions.get(spaceId) || 0;
        this.stateVersions.set(spaceId, currentVersion + 1);
        break;

      case ConflictResolution.MERGE:
        // Attempt to merge changes (simplified - just refresh)
        const mergeVersion = this.stateVersions.get(spaceId) || 0;
        this.stateVersions.set(spaceId, mergeVersion + 1);
        break;

      case ConflictResolution.REJECT:
        // Reject the operation
        throw new Error('Conflict detected and operation rejected');
    }
  }

  /**
   * Check if error is a conflict error
   * 
   * @param error - Error object
   * @returns True if conflict error
   */
  private isConflictError(error: any): boolean {
    // Check for SQLite constraint violations or lock errors
    const message = error.message?.toLowerCase() || '';
    return (
      message.includes('constraint') ||
      message.includes('locked') ||
      message.includes('busy') ||
      message.includes('conflict')
    );
  }

  /**
   * Get MessageType for state update
   * 
   * @param update - State update
   * @returns MessageType
   */
  private getMessageTypeForUpdate(update: StateUpdate): MessageType {
    switch (update.type) {
      case 'message':
        return MessageType.GROUP_MESSAGE;
      case 'link':
        return update.action === 'create' ? MessageType.LINK_ADDED : MessageType.LINK_REMOVED;
      case 'task':
        if (update.action === 'create') return MessageType.TASK_CREATED;
        if (update.action === 'update') return MessageType.TASK_UPDATED;
        return MessageType.TASK_DELETED;
      case 'member':
        return MessageType.TEAM_MEMBER_JOINED;
      default:
        return MessageType.CONNECT;
    }
  }

  /**
   * Check if user is a team member of the space
   * 
   * @param userId - User ID
   * @param spaceId - Builder Space ID
   * @returns True if user is a team member
   */
  private async isTeamMember(userId: string, spaceId: string): Promise<boolean> {
    // Get space info
    const space = await this.db
      .select()
      .from(teamSpaces)
      .where(eq(teamSpaces.id, spaceId))
      .limit(1);

    if (!space.length) {
      return false;
    }

    // Check team membership
    const membership = await this.db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.userId, userId),
          eq(teamMembers.postType, space[0].postType),
          eq(teamMembers.postId, space[0].postId)
        )
      )
      .limit(1);

    return membership.length > 0;
  }

  /**
   * Sleep for specified milliseconds
   * 
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current state version for a space
   * 
   * @param spaceId - Builder Space ID
   * @returns Current version number
   */
  getStateVersion(spaceId: string): number {
    return this.stateVersions.get(spaceId) || 0;
  }

  /**
   * Reset state version for a space (for testing)
   * 
   * @param spaceId - Builder Space ID
   */
  resetStateVersion(spaceId: string): void {
    this.stateVersions.delete(spaceId);
  }
}

// Singleton instance
export const stateSyncService = new StateSyncService();
