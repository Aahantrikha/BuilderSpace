import { db as defaultDb, screeningMessages, applications, users } from '../db/index.js';
import { eq, and, desc } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { ScreeningChatService } from './ScreeningChatService.js';
import { messageBroadcastService, MessageType } from './MessageBroadcastService.js';
import DOMPurify from 'isomorphic-dompurify';

export interface ScreeningMessage {
  id: string;
  applicationId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendMessageParams {
  applicationId: string;
  senderId: string;
  content: string;
}

export class ScreeningMessageService {
  private db: BetterSQLite3Database<any>;
  private screeningChatService: ScreeningChatService;

  constructor(db?: BetterSQLite3Database<any>) {
    this.db = db || defaultDb;
    this.screeningChatService = new ScreeningChatService(this.db);
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
   * Send a screening message with authorization check
   * Only authorized participants (founder and applicant) can send messages
   * 
   * @param params - Message parameters including applicationId, senderId, and content
   * @returns The created message with sender information
   * @throws Error if unauthorized or validation fails
   */
  async sendScreeningMessage(params: SendMessageParams): Promise<ScreeningMessage> {
    const { applicationId, senderId, content } = params;

    // Validate authorization - only founder and applicant can send messages
    const authCheck = await this.screeningChatService.validateScreeningChatAccess(
      applicationId,
      senderId
    );

    if (!authCheck.authorized || !authCheck.participants) {
      throw new Error('Access denied: You are not authorized to send messages in this screening chat');
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

    await this.db.insert(screeningMessages).values({
      id: messageId,
      applicationId,
      senderId,
      content: sanitizedContent,
      createdAt: now,
      updatedAt: now,
    });

    const message: ScreeningMessage = {
      id: messageId,
      applicationId,
      senderId,
      senderName: sender[0].name,
      content: sanitizedContent,
      createdAt: now,
      updatedAt: now,
    };

    // Broadcast message to both participants in real-time (excluding sender)
    messageBroadcastService.broadcastScreeningMessage(
      applicationId,
      authCheck.participants.founderId,
      authCheck.participants.applicantId,
      {
        type: MessageType.SCREENING_MESSAGE,
        payload: message,
        timestamp: now,
        senderId,
      },
      senderId // Exclude sender from broadcast
    );

    return message;
  }

  /**
   * Get screening message history with authorization check
   * Returns messages in chronological order (oldest first)
   * 
   * @param applicationId - The ID of the screening chat (application)
   * @param userId - The ID of the user requesting messages
   * @returns Array of messages with sender information
   * @throws Error if unauthorized
   */
  async getScreeningMessages(applicationId: string, userId: string): Promise<ScreeningMessage[]> {
    // Validate authorization - only founder and applicant can view messages
    const authCheck = await this.screeningChatService.validateScreeningChatAccess(
      applicationId,
      userId
    );

    if (!authCheck.authorized) {
      throw new Error('Access denied: You are not authorized to view messages in this screening chat');
    }

    // Get messages with sender information
    const messages = await this.db
      .select({
        id: screeningMessages.id,
        applicationId: screeningMessages.applicationId,
        senderId: screeningMessages.senderId,
        senderName: users.name,
        content: screeningMessages.content,
        createdAt: screeningMessages.createdAt,
        updatedAt: screeningMessages.updatedAt,
      })
      .from(screeningMessages)
      .leftJoin(users, eq(screeningMessages.senderId, users.id))
      .where(eq(screeningMessages.applicationId, applicationId))
      .orderBy(screeningMessages.createdAt); // Chronological order (oldest first)

    return messages.map(msg => ({
      id: msg.id,
      applicationId: msg.applicationId,
      senderId: msg.senderId,
      senderName: msg.senderName || 'Unknown User',
      content: msg.content,
      createdAt: msg.createdAt || new Date(),
      updatedAt: msg.updatedAt || new Date(),
    }));
  }

  /**
   * Get the most recent message in a screening chat
   * Useful for displaying chat previews
   * 
   * @param applicationId - The ID of the screening chat (application)
   * @param userId - The ID of the user requesting the message
   * @returns The most recent message or null if no messages exist
   * @throws Error if unauthorized
   */
  async getLatestMessage(applicationId: string, userId: string): Promise<ScreeningMessage | null> {
    // Validate authorization
    const authCheck = await this.screeningChatService.validateScreeningChatAccess(
      applicationId,
      userId
    );

    if (!authCheck.authorized) {
      throw new Error('Access denied: You are not authorized to view messages in this screening chat');
    }

    // Get most recent message
    const messages = await this.db
      .select({
        id: screeningMessages.id,
        applicationId: screeningMessages.applicationId,
        senderId: screeningMessages.senderId,
        senderName: users.name,
        content: screeningMessages.content,
        createdAt: screeningMessages.createdAt,
        updatedAt: screeningMessages.updatedAt,
      })
      .from(screeningMessages)
      .leftJoin(users, eq(screeningMessages.senderId, users.id))
      .where(eq(screeningMessages.applicationId, applicationId))
      .orderBy(desc(screeningMessages.createdAt))
      .limit(1);

    if (!messages.length) {
      return null;
    }

    const msg = messages[0];
    return {
      id: msg.id,
      applicationId: msg.applicationId,
      senderId: msg.senderId,
      senderName: msg.senderName || 'Unknown User',
      content: msg.content,
      createdAt: msg.createdAt || new Date(),
      updatedAt: msg.updatedAt || new Date(),
    };
  }

  /**
   * Get message count for a screening chat
   * Useful for displaying unread counts or chat activity
   * 
   * @param applicationId - The ID of the screening chat (application)
   * @param userId - The ID of the user requesting the count
   * @returns The number of messages in the chat
   * @throws Error if unauthorized
   */
  async getMessageCount(applicationId: string, userId: string): Promise<number> {
    // Validate authorization
    const authCheck = await this.screeningChatService.validateScreeningChatAccess(
      applicationId,
      userId
    );

    if (!authCheck.authorized) {
      throw new Error('Access denied: You are not authorized to view this screening chat');
    }

    // Count messages
    const messages = await this.db
      .select()
      .from(screeningMessages)
      .where(eq(screeningMessages.applicationId, applicationId));

    return messages.length;
  }
}

export const screeningMessageService = new ScreeningMessageService();
