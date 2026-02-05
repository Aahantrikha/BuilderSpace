import { db as defaultDb, spaceLinks, teamSpaces, users } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { BuilderSpaceService } from './BuilderSpaceService.js';
import { messageBroadcastService, MessageType } from './MessageBroadcastService.js';
import { URLValidationService } from './URLValidationService.js';

export interface SharedLink {
  id: string;
  spaceId: string;
  creatorId: string;
  creatorName: string;
  title: string;
  url: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddSharedLinkParams {
  spaceId: string;
  creatorId: string;
  title: string;
  url: string;
  description?: string;
}

/**
 * SharedLinkService manages shared links within Builder Spaces
 * 
 * Features:
 * - Add shared links with URL validation
 * - Remove links with creator authorization
 * - Retrieve links for team access
 * - Real-time notifications for link changes
 * 
 * Requirements: 6.1, 6.2, 6.3
 */
export class SharedLinkService {
  private db: BetterSQLite3Database<any>;
  private builderSpaceService: BuilderSpaceService;
  private urlValidationService: URLValidationService;

  constructor(db?: BetterSQLite3Database<any>) {
    this.db = db || defaultDb;
    this.builderSpaceService = new BuilderSpaceService(this.db);
    this.urlValidationService = new URLValidationService();
  }

  /**
   * Validate URL format using URLValidationService
   * Ensures URLs are properly formatted and safe before storing
   * 
   * @param url - The URL to validate
   * @returns True if URL is valid
   * @throws Error if URL is invalid or unsafe
   */
  private validateURL(url: string): boolean {
    const validation = this.urlValidationService.validateURL(url);

    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid URL');
    }

    return true;
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
   * Add a shared link to a Builder Space
   * Validates URL format and team member authorization
   * 
   * @param params - Link parameters including spaceId, creatorId, title, url, and optional description
   * @returns The created link with creator information
   * @throws Error if unauthorized or validation fails
   */
  async addSharedLink(params: AddSharedLinkParams): Promise<SharedLink> {
    const { spaceId, creatorId, title, url, description } = params;

    // Get the space to validate it exists and get post info
    const space = await this.db
      .select()
      .from(teamSpaces)
      .where(eq(teamSpaces.id, spaceId))
      .limit(1);

    if (!space.length) {
      throw new Error('Builder Space not found');
    }

    // Validate authorization - only team members can add links
    const isAuthorized = await this.builderSpaceService.validateTeamMemberAccess(
      creatorId,
      space[0].postType as 'startup' | 'hackathon',
      space[0].postId
    );

    if (!isAuthorized) {
      throw new Error('Access denied: You are not authorized to add links to this Builder Space');
    }

    // Validate URL format
    this.validateURL(url);

    // Validate and sanitize title
    const sanitizedTitle = this.validateTitle(title);

    // Validate and sanitize description
    const sanitizedDescription = this.validateDescription(description);

    // Get creator information
    const creator = await this.db
      .select()
      .from(users)
      .where(eq(users.id, creatorId))
      .limit(1);

    if (!creator.length) {
      throw new Error('Creator not found');
    }

    // Create link
    const now = new Date();
    const linkId = crypto.randomUUID();

    await this.db.insert(spaceLinks).values({
      id: linkId,
      spaceId,
      creatorId,
      title: sanitizedTitle,
      url: url.trim(),
      description: sanitizedDescription,
      createdAt: now,
      updatedAt: now,
    });

    const link: SharedLink = {
      id: linkId,
      spaceId,
      creatorId,
      creatorName: creator[0].name,
      title: sanitizedTitle,
      url: url.trim(),
      description: sanitizedDescription,
      createdAt: now,
      updatedAt: now,
    };

    // Broadcast link addition to all team members in real-time (excluding creator)
    await messageBroadcastService.broadcastGroupMessage(
      spaceId,
      {
        type: MessageType.LINK_ADDED,
        payload: link,
        timestamp: now,
        senderId: creatorId,
      },
      creatorId // Exclude creator from broadcast
    );

    return link;
  }

  /**
   * Remove a shared link from a Builder Space
   * Only the creator can remove their own links
   * 
   * @param linkId - The ID of the link to remove
   * @param userId - The ID of the user requesting removal
   * @throws Error if unauthorized or link not found
   */
  async removeSharedLink(linkId: string, userId: string): Promise<void> {
    // Get the link
    const link = await this.db
      .select()
      .from(spaceLinks)
      .where(eq(spaceLinks.id, linkId))
      .limit(1);

    if (!link.length) {
      throw new Error('Link not found');
    }

    // Validate creator authorization - only creator can delete
    if (link[0].creatorId !== userId) {
      throw new Error('Access denied: Only the link creator can remove this link');
    }

    // Get the space to validate it exists
    const space = await this.db
      .select()
      .from(teamSpaces)
      .where(eq(teamSpaces.id, link[0].spaceId))
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

    // Delete the link
    await this.db
      .delete(spaceLinks)
      .where(eq(spaceLinks.id, linkId));

    // Broadcast link removal to all team members in real-time (excluding remover)
    await messageBroadcastService.broadcastGroupMessage(
      link[0].spaceId,
      {
        type: MessageType.LINK_REMOVED,
        payload: { linkId, spaceId: link[0].spaceId },
        timestamp: new Date(),
        senderId: userId,
      },
      userId // Exclude remover from broadcast
    );
  }

  /**
   * Get all shared links for a Builder Space
   * Only team members can access links
   * 
   * @param spaceId - The ID of the Builder Space
   * @param userId - The ID of the user requesting links
   * @returns Array of links with creator information
   * @throws Error if unauthorized
   */
  async getSharedLinks(spaceId: string, userId: string): Promise<SharedLink[]> {
    // Get the space to validate it exists and get post info
    const space = await this.db
      .select()
      .from(teamSpaces)
      .where(eq(teamSpaces.id, spaceId))
      .limit(1);

    if (!space.length) {
      throw new Error('Builder Space not found');
    }

    // Validate authorization - only team members can view links
    const isAuthorized = await this.builderSpaceService.validateTeamMemberAccess(
      userId,
      space[0].postType as 'startup' | 'hackathon',
      space[0].postId
    );

    if (!isAuthorized) {
      throw new Error('Access denied: You are not authorized to view links in this Builder Space');
    }

    // Get links with creator information
    const links = await this.db
      .select({
        id: spaceLinks.id,
        spaceId: spaceLinks.spaceId,
        creatorId: spaceLinks.creatorId,
        creatorName: users.name,
        title: spaceLinks.title,
        url: spaceLinks.url,
        description: spaceLinks.description,
        createdAt: spaceLinks.createdAt,
        updatedAt: spaceLinks.updatedAt,
      })
      .from(spaceLinks)
      .leftJoin(users, eq(spaceLinks.creatorId, users.id))
      .where(eq(spaceLinks.spaceId, spaceId))
      .orderBy(spaceLinks.createdAt); // Chronological order (oldest first)

    return links.map(link => ({
      id: link.id,
      spaceId: link.spaceId,
      creatorId: link.creatorId,
      creatorName: link.creatorName || 'Unknown User',
      title: link.title,
      url: link.url,
      description: link.description || undefined,
      createdAt: link.createdAt || new Date(),
      updatedAt: link.updatedAt || new Date(),
    }));
  }

  /**
   * Get a specific shared link by ID
   * Only team members can access the link
   * 
   * @param linkId - The ID of the link
   * @param userId - The ID of the user requesting the link
   * @returns The link with creator information
   * @throws Error if unauthorized or link not found
   */
  async getSharedLink(linkId: string, userId: string): Promise<SharedLink> {
    // Get the link
    const links = await this.db
      .select({
        id: spaceLinks.id,
        spaceId: spaceLinks.spaceId,
        creatorId: spaceLinks.creatorId,
        creatorName: users.name,
        title: spaceLinks.title,
        url: spaceLinks.url,
        description: spaceLinks.description,
        createdAt: spaceLinks.createdAt,
        updatedAt: spaceLinks.updatedAt,
      })
      .from(spaceLinks)
      .leftJoin(users, eq(spaceLinks.creatorId, users.id))
      .where(eq(spaceLinks.id, linkId))
      .limit(1);

    if (!links.length) {
      throw new Error('Link not found');
    }

    const link = links[0];

    // Get the space to validate authorization
    const space = await this.db
      .select()
      .from(teamSpaces)
      .where(eq(teamSpaces.id, link.spaceId))
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
      throw new Error('Access denied: You are not authorized to view this link');
    }

    return {
      id: link.id,
      spaceId: link.spaceId,
      creatorId: link.creatorId,
      creatorName: link.creatorName || 'Unknown User',
      title: link.title,
      url: link.url,
      description: link.description || undefined,
      createdAt: link.createdAt || new Date(),
      updatedAt: link.updatedAt || new Date(),
    };
  }

  /**
   * Get link count for a Builder Space
   * Useful for displaying link counts or activity indicators
   * 
   * @param spaceId - The ID of the Builder Space
   * @param userId - The ID of the user requesting the count
   * @returns The number of links in the Builder Space
   * @throws Error if unauthorized
   */
  async getLinkCount(spaceId: string, userId: string): Promise<number> {
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

    // Count links
    const links = await this.db
      .select()
      .from(spaceLinks)
      .where(eq(spaceLinks.spaceId, spaceId));

    return links.length;
  }
}

export const sharedLinkService = new SharedLinkService();
