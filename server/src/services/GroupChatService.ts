import { SpaceMessage, TeamSpace, User } from '../db/index.js';
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
  private builderSpaceService: BuilderSpaceService;

  constructor() {
    this.builderSpaceService = new BuilderSpaceService();
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
    const space = await TeamSpace.findById(spaceId);

    if (!space) {
      throw new Error('Builder Space not found');
    }

    // Validate authorization - only team members can send messages
    const isAuthorized = await this.builderSpaceService.validateTeamMemberAccess(
      senderId,
      space.postType as 'startup' | 'hackathon',
      space.postId
    );

    if (!isAuthorized) {
      throw new Error('Access denied: You are not authorized to send messages in this Builder Space');
    }

    // Validate and sanitize content
    const sanitizedContent = this.validateAndSanitizeContent(content);

    // Get sender information
    const sender = await User.findById(senderId);

    if (!sender) {
      throw new Error('Sender not found');
    }

    // Create message
    const message = await SpaceMessage.create({
      spaceId,
      senderId,
      content: sanitizedContent,
    });

    const messageData: GroupMessage = {
      id: message.id,
      spaceId,
      senderId,
      senderName: sender.name,
      content: sanitizedContent,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };

    // Broadcast message to all team members in real-time (excluding sender)
    await messageBroadcastService.broadcastGroupMessage(
      spaceId,
      {
        type: MessageType.GROUP_MESSAGE,
        payload: messageData,
        timestamp: message.createdAt,
        senderId,
      },
      senderId // Exclude sender from broadcast
    );

    return messageData;
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
    const space = await TeamSpace.findById(spaceId);

    if (!space) {
      throw new Error('Builder Space not found');
    }

    // Validate authorization - only team members can view messages
    const isAuthorized = await this.builderSpaceService.validateTeamMemberAccess(
      userId,
      space.postType as 'startup' | 'hackathon',
      space.postId
    );

    if (!isAuthorized) {
      throw new Error('Access denied: You are not authorized to view messages in this Builder Space');
    }

    // Get messages with sender information
    const messages = await SpaceMessage.find({ spaceId })
      .populate('senderId', 'name')
      .sort({ createdAt: 1 }) // Chronological order (oldest first)
      .lean();

    return messages.map((msg: any) => ({
      id: msg.id || msg._id.toString(),
      spaceId: msg.spaceId,
      senderId: msg.senderId?._id?.toString() || msg.senderId,
      senderName: msg.senderId?.name || 'Unknown User',
      content: msg.content,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
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
    const space = await TeamSpace.findById(spaceId);

    if (!space) {
      throw new Error('Builder Space not found');
    }

    // Validate authorization
    const isAuthorized = await this.builderSpaceService.validateTeamMemberAccess(
      userId,
      space.postType as 'startup' | 'hackathon',
      space.postId
    );

    if (!isAuthorized) {
      throw new Error('Access denied: You are not authorized to view messages in this Builder Space');
    }

    // Get most recent message
    const message = await SpaceMessage.findOne({ spaceId })
      .populate('senderId', 'name')
      .sort({ createdAt: -1 })
      .limit(1)
      .lean();

    if (!message) {
      return null;
    }

    return {
      id: message.id || (message as any)._id.toString(),
      spaceId: message.spaceId,
      senderId: (message.senderId as any)?._id?.toString() || message.senderId,
      senderName: (message.senderId as any)?.name || 'Unknown User',
      content: message.content,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
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
    const space = await TeamSpace.findById(spaceId);

    if (!space) {
      throw new Error('Builder Space not found');
    }

    // Validate authorization
    const isAuthorized = await this.builderSpaceService.validateTeamMemberAccess(
      userId,
      space.postType as 'startup' | 'hackathon',
      space.postId
    );

    if (!isAuthorized) {
      throw new Error('Access denied: You are not authorized to view this Builder Space');
    }

    // Count messages
    return await SpaceMessage.countDocuments({ spaceId });
  }
}

export const groupChatService = new GroupChatService();
