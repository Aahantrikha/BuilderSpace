import { ScreeningMessage, Application, User } from '../db/index.js';
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
  private screeningChatService: ScreeningChatService;

  constructor() {
    this.screeningChatService = new ScreeningChatService();
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
    const sender = await User.findById(senderId);

    if (!sender) {
      throw new Error('Sender not found');
    }

    // Create message
    const message = await ScreeningMessage.create({
      applicationId,
      senderId,
      content: sanitizedContent,
    });

    const messageData: ScreeningMessage = {
      id: message.id,
      applicationId,
      senderId,
      senderName: sender.name,
      content: sanitizedContent,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };

    // Broadcast message to both participants in real-time (excluding sender)
    messageBroadcastService.broadcastScreeningMessage(
      applicationId,
      authCheck.participants.founderId,
      authCheck.participants.applicantId,
      {
        type: MessageType.SCREENING_MESSAGE,
        payload: messageData,
        timestamp: message.createdAt,
        senderId,
      },
      senderId // Exclude sender from broadcast
    );

    return messageData;
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
    const messages = await ScreeningMessage.find({ applicationId })
      .populate('senderId', 'name')
      .sort({ createdAt: 1 }) // Chronological order (oldest first)
      .lean();

    return messages.map((msg: any) => ({
      id: msg.id || msg._id.toString(),
      applicationId: msg.applicationId,
      senderId: msg.senderId?._id?.toString() || msg.senderId,
      senderName: msg.senderId?.name || 'Unknown User',
      content: msg.content,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
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
    const message = await ScreeningMessage.findOne({ applicationId })
      .populate('senderId', 'name')
      .sort({ createdAt: -1 })
      .limit(1)
      .lean();

    if (!message) {
      return null;
    }

    return {
      id: message.id || (message as any)._id.toString(),
      applicationId: message.applicationId.toString(),
      senderId: (message.senderId as any)?._id?.toString() || message.senderId,
      senderName: (message.senderId as any)?.name || 'Unknown User',
      content: message.content,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
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
    return await ScreeningMessage.countDocuments({ applicationId });
  }
}

export const screeningMessageService = new ScreeningMessageService();
