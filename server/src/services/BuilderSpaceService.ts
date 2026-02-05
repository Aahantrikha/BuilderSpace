import { db as defaultDb, teamSpaces, teamMembers, startups, hackathons } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export interface BuilderSpaceDetails {
  id: string;
  postType: 'startup' | 'hackathon';
  postId: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class BuilderSpaceService {
  private db: BetterSQLite3Database<any>;

  constructor(db?: BetterSQLite3Database<any>) {
    this.db = db || defaultDb;
  }

  /**
   * Create a Builder Space for a team
   * Validates that only one Builder Space exists per team
   * 
   * @param postType - The type of post (startup or hackathon)
   * @param postId - The ID of the post
   * @param name - The name for the Builder Space
   * @param description - Optional description for the Builder Space
   * @returns The created Builder Space details
   * @throws Error if Builder Space already exists for this team
   */
  async createBuilderSpace(
    postType: 'startup' | 'hackathon',
    postId: string,
    name: string,
    description?: string
  ): Promise<BuilderSpaceDetails> {
    // Validate that post exists
    if (postType === 'startup') {
      const startup = await this.db
        .select()
        .from(startups)
        .where(eq(startups.id, postId))
        .limit(1);

      if (!startup.length) {
        throw new Error('Startup not found');
      }
    } else {
      const hackathon = await this.db
        .select()
        .from(hackathons)
        .where(eq(hackathons.id, postId))
        .limit(1);

      if (!hackathon.length) {
        throw new Error('Hackathon not found');
      }
    }

    // Check if Builder Space already exists (uniqueness validation)
    const existingSpace = await this.db
      .select()
      .from(teamSpaces)
      .where(
        and(
          eq(teamSpaces.postType, postType),
          eq(teamSpaces.postId, postId)
        )
      )
      .limit(1);

    if (existingSpace.length > 0) {
      throw new Error('Builder Space already exists for this team');
    }

    // Create new Builder Space
    const result = await this.db
      .insert(teamSpaces)
      .values({
        postType,
        postId,
        name,
        description,
      })
      .returning();

    return result[0] as BuilderSpaceDetails;
  }

  /**
   * Get a Builder Space by ID with team member authorization
   * 
   * @param spaceId - The ID of the Builder Space
   * @param userId - The ID of the user requesting access
   * @returns The Builder Space details
   * @throws Error if space not found or user is not authorized
   */
  async getBuilderSpace(spaceId: string, userId: string): Promise<BuilderSpaceDetails> {
    // Get the space
    const space = await this.db
      .select()
      .from(teamSpaces)
      .where(eq(teamSpaces.id, spaceId))
      .limit(1);

    if (!space.length) {
      throw new Error('Builder Space not found');
    }

    // Validate user is a team member
    const isAuthorized = await this.validateTeamMemberAccess(
      userId,
      space[0].postType as 'startup' | 'hackathon',
      space[0].postId
    );

    if (!isAuthorized) {
      throw new Error('Access denied: User is not a team member');
    }

    return space[0] as BuilderSpaceDetails;
  }

  /**
   * Get a Builder Space by post type and ID
   * 
   * @param postType - The type of post (startup or hackathon)
   * @param postId - The ID of the post
   * @returns The Builder Space details or null if not found
   */
  async getBuilderSpaceByPost(
    postType: 'startup' | 'hackathon',
    postId: string
  ): Promise<BuilderSpaceDetails | null> {
    const space = await this.db
      .select()
      .from(teamSpaces)
      .where(
        and(
          eq(teamSpaces.postType, postType),
          eq(teamSpaces.postId, postId)
        )
      )
      .limit(1);

    return space.length > 0 ? (space[0] as BuilderSpaceDetails) : null;
  }

  /**
   * Get a Builder Space by post type and ID with authorization
   * 
   * @param postType - The type of post (startup or hackathon)
   * @param postId - The ID of the post
   * @param userId - The ID of the user requesting access
   * @returns The Builder Space details
   * @throws Error if space not found or user is not authorized
   */
  async getBuilderSpaceByPostWithAuth(
    postType: 'startup' | 'hackathon',
    postId: string,
    userId: string
  ): Promise<BuilderSpaceDetails> {
    const space = await this.getBuilderSpaceByPost(postType, postId);

    if (!space) {
      throw new Error('Builder Space not found');
    }

    // Validate user is a team member
    const isAuthorized = await this.validateTeamMemberAccess(userId, postType, postId);

    if (!isAuthorized) {
      throw new Error('Access denied: User is not a team member');
    }

    return space;
  }

  /**
   * Validate if a user is a team member and has access to the Builder Space
   * 
   * @param userId - The ID of the user
   * @param postType - The type of post (startup or hackathon)
   * @param postId - The ID of the post
   * @returns True if user is a team member, false otherwise
   */
  async validateTeamMemberAccess(
    userId: string,
    postType: 'startup' | 'hackathon',
    postId: string
  ): Promise<boolean> {
    const member = await this.db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.userId, userId),
          eq(teamMembers.postType, postType),
          eq(teamMembers.postId, postId)
        )
      )
      .limit(1);

    return member.length > 0;
  }

  /**
   * Validate Builder Space uniqueness for a team
   * 
   * @param postType - The type of post (startup or hackathon)
   * @param postId - The ID of the post
   * @returns True if no Builder Space exists, false if one already exists
   */
  async validateBuilderSpaceUniqueness(
    postType: 'startup' | 'hackathon',
    postId: string
  ): Promise<boolean> {
    const existingSpace = await this.db
      .select()
      .from(teamSpaces)
      .where(
        and(
          eq(teamSpaces.postType, postType),
          eq(teamSpaces.postId, postId)
        )
      )
      .limit(1);

    return existingSpace.length === 0;
  }

  /**
   * Get all Builder Spaces for a user (across all teams they're a member of)
   * 
   * @param userId - The ID of the user
   * @returns Array of Builder Space details
   */
  async getUserBuilderSpaces(userId: string): Promise<BuilderSpaceDetails[]> {
    // Get all team memberships for the user
    const memberships = await this.db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    if (memberships.length === 0) {
      return [];
    }

    // Get all Builder Spaces for those teams
    const spaces: BuilderSpaceDetails[] = [];
    for (const membership of memberships) {
      const space = await this.getBuilderSpaceByPost(
        membership.postType as 'startup' | 'hackathon',
        membership.postId
      );
      if (space) {
        spaces.push(space);
      }
    }

    return spaces;
  }
}

export const builderSpaceService = new BuilderSpaceService();
