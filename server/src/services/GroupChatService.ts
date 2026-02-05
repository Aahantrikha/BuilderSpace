import { db as defaultDb, spaceMessages, teamSpaces, users } from '../db/index.js';
import { eq, desc } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { BuilderSpaceService } from './BuilderSpaceService.js';
import { messageBroadcastService, MessageType } from './MessageBroadcastService.js';
import DOMPurify from 'isomorphic-dompurify';

export interface GroupMessage {
  id: string;
  spaceId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendGroupMessageParams {
  spaceId: string;
  senderId: string;
  content: string;
}

export class GroupChatService {
  private db: BetterSQLite3Database<any>;
  private builderSpaceService: BuilderSpaceService;

  constructor(db?: BetterSQLite3Database<any>) {
    this.db = db || defaultDb;
    this.builderSpaceService = new BuilderSpaceService(this.db);
  }

  /**
   * Validate and sanitize message content
   * Removes potentially harmful content and ensures message is not empty
   * 
   * @param content - The raw message content
   * @returns Sanitized content
   * @throws Error if content is empty after sanitization
   */
  private validateAndSanitizeContent(content: string): string {
    // Trim whitespace
    const trimmed = content.trim();

    if (!trimmed) {
      throw new Error('Message content cannot be empty');
    }

    // Sanitize HTML/XSS content
    const sanitized = DOMPurify.sanitize(trimmed, {
      ALLOWED_TAGS: [], // Strip all HTML tags
      ALLOWED_ATTR: [], // Strip all attributes
      KEEP_CONTENT: true, // Keep text content
    });

    if (!sanitized.trim()) {
      throw new Error('Message content cannot be empty after sanitization');
    }

    // Limit message length
    const maxLength = 5000;
    if (sanitized.length > maxLength) {
      throw new Error(`Message content cannot exceed ${maxLength} characters`);
    }

    return sanitized;
  }

  /**
   * Send a group message with team member validation
   * Only team members can send messages in the Builder Space
   * 
   * @param params - Message parameters including spaceId, senderId, and content
   * @returns The created message with sender information
   * @throws Error if unauthorized or validation fails
   */
  async sendGroupMessage(params: SendGroupMessageParams): Promise<GroupMessage> {
    const { spaceId, senderId, content } = params;

    // Get the space to validate it exists and get post info
    const space = await this.db
      .select()
      .from(teamSpaces)
      .where(eq(teamSpaces.id, spaceId))
      .limit(1);

    if (!space.length) {
      throw new Error('Builder Space not found');
    }

    // Validate authorization - only team members can send messages
    const isAuthorized = await this.builderSpaceService.validateTeamMemberAccess(
      senderId,
      space[0].postType as 'startup' | 'hackathon',
      space[0].postId
    );

    if (!isAuthorized) {
      throw new Error('Access denied: You are not authorized to send messages in this Builder Space');
    }

    // Validate and sanitize content
    const sanitizedContent = this.validateAndSanitizeContent(content);

    // Get sender information
    const sender = await this.db
      .select()
      .from(users)
      .where(eq(users.id, senderId))
      .limit(1);

    if (!sender.length) {
      throw new Error('Sender not found');
    }

    // Create message
    const now = new Date();
    const messageId = crypto.randomUUID();

    await this.db.insert(spaceMessages).values({
      id: messageId,
      spaceId,
      senderId,
      content: sanitizedContent,
      createdAt: now,
      updatedAt: now,
    });

    const message: GroupMessage = {
      id: messageId,
      spaceId,
      senderId,
      senderName: sender[0].name,
      content: sanitizedContent,
      createdAt: now,
      updatedAt: now,
    };

    // Broadcast message to all team members in real-time (excluding sender)
    await messageBroadcastService.broadcastGroupMessage(
      spaceId,
      {
        type: MessageType.GROUP_MESSAGE,
        payload: message,
        timestamp: now,
        senderId,
      },
      senderId // Exclude sender from broadcast
    );

    return message;
  }

  /**
   * Get group message history with team member authorization
   * Returns messages in chronological order (oldest first)
   * 
   * @param spaceId - The ID of the Builder Space
   * @param userId - The ID of the user requesting messages
   * @returns Array of messages with sender information
   * @throws Error if unauthorized
   */
  async getGroupMessages(spaceId: string, userId: string): Promise<GroupMessage[]> {
    // Get the space to validate it exists and get post info
    const space = await this.db
      .select()
      .from(teamSpaces)
      .where(eq(teamSpaces.id, spaceId))
      .limit(1);

    if (!space.length) {
      throw new Error('Builder Space not found');
    }

    // Validate authorization - only team members can view messages
    const isAuthorized = await this.builderSpaceService.validateTeamMemberAccess(
      userId,
      space[0].postType as 'startup' | 'hackathon',
      space[0].postId
    );

    if (!isAuthorized) {
      throw new Error('Access denied: You are not authorized to view messages in this Builder Space');
    }

    // Get messages with sender information
    const messages = await this.db
      .select({
        id: spaceMessages.id,
        spaceId: spaceMessages.spaceId,
        senderId: spaceMessages.senderId,
        senderName: users.name,
        content: spaceMessages.content,
        createdAt: spaceMessages.createdAt,
        updatedAt: spaceMessages.updatedAt,
      })
      .from(spaceMessages)
      .leftJoin(users, eq(spaceMessages.senderId, users.id))
      .where(eq(spaceMessages.spaceId, spaceId))
      .orderBy(spaceMessages.createdAt); // Chronological order (oldest first)

    return messages.map(msg => ({
      id: msg.id,
      spaceId: msg.spaceId,
      senderId: msg.senderId,
      senderName: msg.senderName || 'Unknown User',
      content: msg.content,
      createdAt: msg.createdAt || new Date(),
      updatedAt: msg.updatedAt || new Date(),
    }));
  }

  /**
   * Get the most recent message in a Builder Space
   * Useful for displaying chat previews
   * 
   * @param spaceId - The ID of the Builder Space
   * @param userId - The ID of the user requesting the message
   * @returns The most recent message or null if no messages exist
   * @throws Error if unauthorized
   */
  async getLatestMessage(spaceId: string, userId: string): Promise<GroupMessage | null> {
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
      throw new Error('Access denied: You are not authorized to view messages in this Builder Space');
    }

    // Get most recent message
    const messages = await this.db
      .select({
        id: spaceMessages.id,
        spaceId: spaceMessages.spaceId,
        senderId: spaceMessages.senderId,
        senderName: users.name,
        content: spaceMessages.content,
        createdAt: spaceMessages.createdAt,
        updatedAt: spaceMessages.updatedAt,
      })
      .from(spaceMessages)
      .leftJoin(users, eq(spaceMessages.senderId, users.id))
      .where(eq(spaceMessages.spaceId, spaceId))
      .orderBy(desc(spaceMessages.createdAt))
      .limit(1);

    if (!messages.length) {
      return null;
    }

    const msg = messages[0];
    return {
      id: msg.id,
      spaceId: msg.spaceId,
      senderId: msg.senderId,
      senderName: msg.senderName || 'Unknown User',
      content: msg.content,
      createdAt: msg.createdAt || new Date(),
      updatedAt: msg.updatedAt || new Date(),
    };
  }

  /**
   * Get message count for a Builder Space
   * Useful for displaying message counts or activity indicators
   * 
   * @param spaceId - The ID of the Builder Space
   * @param userId - The ID of the user requesting the count
   * @returns The number of messages in the Builder Space
   * @throws Error if unauthorized
   */
  async getMessageCount(spaceId: string, userId: string): Promise<number> {
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

    // Count messages
    const messages = await this.db
      .select()
      .from(spaceMessages)
      .where(eq(spaceMessages.spaceId, spaceId));

    return messages.length;
  }
}

export const groupChatService = new GroupChatService();
