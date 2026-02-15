import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import { db as defaultDb, teamMembers } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

/**
 * Message types for WebSocket communication
 */
export enum MessageType {
  // Connection management
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  HEARTBEAT = 'heartbeat',
  
  // Group chat messages
  GROUP_MESSAGE = 'group_message',
  
  // Screening chat messages
  SCREENING_MESSAGE = 'screening_message',
  
  // Builder Space updates
  LINK_ADDED = 'link_added',
  LINK_REMOVED = 'link_removed',
  TASK_CREATED = 'task_created',
  TASK_UPDATED = 'task_updated',
  TASK_DELETED = 'task_deleted',
  
  // Team formation
  TEAM_MEMBER_JOINED = 'team_member_joined',
  BUILDER_SPACE_CREATED = 'builder_space_created',
  
  // Screening chat creation
  SCREENING_CHAT_CREATED = 'screening_chat_created',
  
  // User status
  USER_ONLINE = 'user_online',
  USER_OFFLINE = 'user_offline',
  
  // Platform stats
  STATS_UPDATE = 'stats_update',
}

/**
 * WebSocket message payload structure
 */
export interface BroadcastMessage {
  type: MessageType;
  payload: any;
  timestamp: Date;
  senderId?: string;
}

/**
 * Connection information for tracking online users
 */
interface ConnectionInfo {
  userId: string;
  ws: WebSocket;
  lastHeartbeat: Date;
}

/**
 * Queued message for offline users
 */
interface QueuedMessage {
  userId: string;
  message: BroadcastMessage;
  queuedAt: Date;
}

/**
 * MessageBroadcastService handles real-time message delivery via WebSocket
 * 
 * Features:
 * - WebSocket connection management
 * - Online user tracking
 * - Message broadcasting to team members
 * - Message queuing for offline users
 * - Heartbeat monitoring for connection health
 * 
 * Requirements: 5.1, 5.5, 8.1
 */
export class MessageBroadcastService {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, ConnectionInfo> = new Map();
  private messageQueue: Map<string, QueuedMessage[]> = new Map();
  private db: BetterSQLite3Database<any>;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly MESSAGE_QUEUE_MAX_SIZE = 100; // Max queued messages per user
  private readonly MESSAGE_QUEUE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

  constructor(db?: BetterSQLite3Database<any>) {
    this.db = db || defaultDb;
  }

  /**
   * Initialize WebSocket server
   * 
   * @param server - HTTP server instance to attach WebSocket server to
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      this.handleConnection(ws, req);
    });

    // Start heartbeat monitoring
    this.startHeartbeatMonitoring();

    console.log('✅ MessageBroadcastService initialized with WebSocket support');
  }

  /**
   * Handle new WebSocket connection
   * 
   * @param ws - WebSocket connection
   * @param req - HTTP request
   */
  private handleConnection(ws: WebSocket, req: any): void {
    // Extract userId from query parameters or headers
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      ws.close(1008, 'User ID required');
      return;
    }

    // Store connection
    this.connections.set(userId, {
      userId,
      ws,
      lastHeartbeat: new Date(),
    });

    console.log(`🔌 User ${userId} connected via WebSocket`);

    // Send connection confirmation
    this.sendToUser(userId, {
      type: MessageType.CONNECT,
      payload: { userId, message: 'Connected successfully' },
      timestamp: new Date(),
    });

    // Deliver queued messages
    this.deliverQueuedMessages(userId);

    // Notify others that user is online
    this.broadcastUserStatus(userId, true);

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      this.handleMessage(userId, data);
    });

    // Handle disconnection
    ws.on('close', () => {
      this.handleDisconnection(userId);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
    });
  }

  /**
   * Handle incoming WebSocket message
   * 
   * @param userId - User ID of sender
   * @param data - Message data
   */
  private handleMessage(userId: string, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());

      // Handle heartbeat
      if (message.type === MessageType.HEARTBEAT) {
        const connection = this.connections.get(userId);
        if (connection) {
          connection.lastHeartbeat = new Date();
          // Send heartbeat response
          this.sendToUser(userId, {
            type: MessageType.HEARTBEAT,
            payload: { timestamp: new Date() },
            timestamp: new Date(),
          });
        }
      }
    } catch (error) {
      console.error(`Error handling message from user ${userId}:`, error);
    }
  }

  /**
   * Handle user disconnection
   * 
   * @param userId - User ID
   */
  private handleDisconnection(userId: string): void {
    this.connections.delete(userId);
    console.log(`🔌 User ${userId} disconnected from WebSocket`);

    // Notify others that user is offline
    this.broadcastUserStatus(userId, false);
  }

  /**
   * Start heartbeat monitoring to detect stale connections
   */
  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const staleThreshold = 60000; // 60 seconds

      for (const [userId, connection] of this.connections.entries()) {
        const timeSinceHeartbeat = now.getTime() - connection.lastHeartbeat.getTime();
        
        if (timeSinceHeartbeat > staleThreshold) {
          console.log(`⚠️ Stale connection detected for user ${userId}, closing...`);
          connection.ws.close(1000, 'Connection timeout');
          this.connections.delete(userId);
        }
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Stop heartbeat monitoring
   */
  private stopHeartbeatMonitoring(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Send message to a specific user
   * 
   * @param userId - User ID
   * @param message - Message to send
   * @returns True if message was sent, false if user is offline
   */
  sendToUser(userId: string, message: BroadcastMessage): boolean {
    const connection = this.connections.get(userId);

    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      try {
        connection.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error(`Error sending message to user ${userId}:`, error);
        return false;
      }
    }

    // User is offline, queue the message
    this.queueMessage(userId, message);
    return false;
  }

  /**
   * Broadcast message to multiple users
   * 
   * @param userIds - Array of user IDs
   * @param message - Message to broadcast
   * @returns Object with counts of online and offline users
   */
  broadcastToUsers(userIds: string[], message: BroadcastMessage): { online: number; offline: number } {
    let online = 0;
    let offline = 0;

    for (const userId of userIds) {
      const sent = this.sendToUser(userId, message);
      if (sent) {
        online++;
      } else {
        offline++;
      }
    }

    return { online, offline };
  }

  /**
   * Broadcast group message to all team members
   * 
   * @param spaceId - Builder Space ID
   * @param message - Message to broadcast
   * @param excludeUserId - Optional user ID to exclude from broadcast (e.g., sender)
   */
  async broadcastGroupMessage(
    spaceId: string,
    message: BroadcastMessage,
    excludeUserId?: string
  ): Promise<void> {
    const teamMemberIds = await this.getTeamMembersBySpace(spaceId);
    const recipientIds = excludeUserId 
      ? teamMemberIds.filter(id => id !== excludeUserId)
      : teamMemberIds;

    const result = this.broadcastToUsers(recipientIds, message);
    console.log(`📢 Broadcast to space ${spaceId}: ${result.online} online, ${result.offline} offline`);
  }

  /**
   * Broadcast screening message to both participants
   * 
   * @param applicationId - Application ID (screening chat ID)
   * @param founderId - Founder user ID
   * @param applicantId - Applicant user ID
   * @param message - Message to broadcast
   * @param excludeUserId - Optional user ID to exclude from broadcast (e.g., sender)
   */
  broadcastScreeningMessage(
    applicationId: string,
    founderId: string,
    applicantId: string,
    message: BroadcastMessage,
    excludeUserId?: string
  ): void {
    const recipientIds = [founderId, applicantId].filter(id => id !== excludeUserId);
    const result = this.broadcastToUsers(recipientIds, message);
    console.log(`📢 Broadcast screening message: ${result.online} online, ${result.offline} offline`);
  }

  /**
   * Broadcast user online/offline status
   * 
   * @param userId - User ID
   * @param isOnline - Whether user is online
   */
  private async broadcastUserStatus(userId: string, isOnline: boolean): Promise<void> {
    // Get all spaces the user is a member of
    const spaces = await this.getUserSpaces(userId);

    for (const spaceId of spaces) {
      const teamMemberIds = await this.getTeamMembersBySpace(spaceId);
      const recipientIds = teamMemberIds.filter(id => id !== userId);

      this.broadcastToUsers(recipientIds, {
        type: isOnline ? MessageType.USER_ONLINE : MessageType.USER_OFFLINE,
        payload: { userId },
        timestamp: new Date(),
      });
    }
  }

  /**
   * Queue message for offline user
   * 
   * @param userId - User ID
   * @param message - Message to queue
   */
  private queueMessage(userId: string, message: BroadcastMessage): void {
    if (!this.messageQueue.has(userId)) {
      this.messageQueue.set(userId, []);
    }

    const queue = this.messageQueue.get(userId)!;

    // Check queue size limit
    if (queue.length >= this.MESSAGE_QUEUE_MAX_SIZE) {
      // Remove oldest message
      queue.shift();
    }

    queue.push({
      userId,
      message,
      queuedAt: new Date(),
    });

    console.log(`📬 Queued message for offline user ${userId} (queue size: ${queue.length})`);
  }

  /**
   * Deliver queued messages to user when they come online
   * 
   * @param userId - User ID
   */
  private deliverQueuedMessages(userId: string): void {
    const queue = this.messageQueue.get(userId);

    if (!queue || queue.length === 0) {
      return;
    }

    const now = new Date();
    let delivered = 0;
    let expired = 0;

    for (const queuedMessage of queue) {
      const age = now.getTime() - queuedMessage.queuedAt.getTime();

      // Skip expired messages
      if (age > this.MESSAGE_QUEUE_MAX_AGE) {
        expired++;
        continue;
      }

      // Deliver message
      const sent = this.sendToUser(userId, queuedMessage.message);
      if (sent) {
        delivered++;
      }
    }

    // Clear queue
    this.messageQueue.delete(userId);

    console.log(`📬 Delivered ${delivered} queued messages to user ${userId} (${expired} expired)`);
  }

  /**
   * Get team member IDs for a Builder Space
   * 
   * @param spaceId - Builder Space ID
   * @returns Array of user IDs
   */
  private async getTeamMembersBySpace(spaceId: string): Promise<string[]> {
    // First, get the space to find postType and postId
    const { teamSpaces } = await import('../db/index.js');
    
    const space = await this.db
      .select()
      .from(teamSpaces)
      .where(eq(teamSpaces.id, spaceId))
      .limit(1);

    if (!space.length) {
      return [];
    }

    // Get team members for this post
    const members = await this.db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.postType, space[0].postType),
          eq(teamMembers.postId, space[0].postId)
        )
      );

    return members.map(m => m.userId);
  }

  /**
   * Get all Builder Space IDs that a user is a member of
   * 
   * @param userId - User ID
   * @returns Array of space IDs
   */
  private async getUserSpaces(userId: string): Promise<string[]> {
    const { teamSpaces } = await import('../db/index.js');
    
    // Get all team memberships for this user
    const memberships = await this.db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    // Get corresponding spaces
    const spaceIds: string[] = [];
    for (const membership of memberships) {
      const spaces = await this.db
        .select()
        .from(teamSpaces)
        .where(
          and(
            eq(teamSpaces.postType, membership.postType),
            eq(teamSpaces.postId, membership.postId)
          )
        );

      spaceIds.push(...spaces.map(s => s.id));
    }

    return spaceIds;
  }

  /**
   * Check if a user is currently online
   * 
   * @param userId - User ID
   * @returns True if user is online
   */
  isUserOnline(userId: string): boolean {
    return this.connections.has(userId);
  }

  /**
   * Get list of online user IDs
   * 
   * @returns Array of online user IDs
   */
  getOnlineUsers(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Get count of online users
   * 
   * @returns Number of online users
   */
  getOnlineUserCount(): number {
    return this.connections.size;
  }

  /**
   * Get queued message count for a user
   * 
   * @param userId - User ID
   * @returns Number of queued messages
   */
  getQueuedMessageCount(userId: string): number {
    const queue = this.messageQueue.get(userId);
    return queue ? queue.length : 0;
  }

  /**
   * Broadcast platform statistics update to all connected users
   * 
   * @param stats - Platform statistics
   */
  broadcastStatsUpdate(stats: { users: number; startups: number; hackathons: number; applications: number }): void {
    const message: BroadcastMessage = {
      type: MessageType.STATS_UPDATE,
      payload: stats,
      timestamp: new Date(),
    };

    // Broadcast to all connected users
    const onlineUsers = this.getOnlineUsers();
    this.broadcastToUsers(onlineUsers, message);
    console.log(`📊 Broadcast stats update to ${onlineUsers.length} users`);
  }

  /**
   * Shutdown the WebSocket server and clean up resources
   */
  shutdown(): void {
    console.log('🛑 Shutting down MessageBroadcastService...');

    // Stop heartbeat monitoring
    this.stopHeartbeatMonitoring();

    // Close all connections
    for (const [userId, connection] of this.connections.entries()) {
      connection.ws.close(1000, 'Server shutting down');
    }

    this.connections.clear();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close(() => {
        console.log('✅ WebSocket server closed');
      });
    }
  }
}

// Singleton instance
export const messageBroadcastService = new MessageBroadcastService();
