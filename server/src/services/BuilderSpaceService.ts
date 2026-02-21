import { TeamSpace, TeamMember, Startup, Hackathon } from '../db/index.js';

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
      const startup = await Startup.findById(postId);
      if (!startup) {
        throw new Error('Startup not found');
      }
    } else {
      const hackathon = await Hackathon.findById(postId);
      if (!hackathon) {
        throw new Error('Hackathon not found');
      }
    }

    // Check if Builder Space already exists (uniqueness validation)
    const existingSpace = await TeamSpace.findOne({
      postType,
      postId
    });

    if (existingSpace) {
      throw new Error('Builder Space already exists for this team');
    }

    // Create new Builder Space
    const result = await TeamSpace.create({
      postType,
      postId,
      name,
      description,
    });

    return result.toObject() as BuilderSpaceDetails;
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
    const space = await TeamSpace.findById(spaceId);

    if (!space) {
      throw new Error('Builder Space not found');
    }

    // Validate user is a team member
    const isAuthorized = await this.validateTeamMemberAccess(
      userId,
      space.postType as 'startup' | 'hackathon',
      space.postId.toString()
    );

    if (!isAuthorized) {
      throw new Error('Access denied: User is not a team member');
    }

    return space.toObject() as BuilderSpaceDetails;
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
    const space = await TeamSpace.findOne({
      postType,
      postId
    });

    return space ? (space.toObject() as BuilderSpaceDetails) : null;
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
    console.log('[BuilderSpaceService] Validating team member access');
    console.log('[BuilderSpaceService] userId:', userId, 'type:', typeof userId);
    console.log('[BuilderSpaceService] postType:', postType);
    console.log('[BuilderSpaceService] postId:', postId, 'type:', typeof postId);
    
    const member = await TeamMember.findOne({
      userId,
      postType,
      postId
    });

    console.log('[BuilderSpaceService] Member found:', member ? 'YES' : 'NO');
    if (member) {
      console.log('[BuilderSpaceService] Member details:', {
        userId: member.userId.toString(),
        postType: member.postType,
        postId: member.postId.toString(),
        role: member.role
      });
    }

    return !!member;
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
    const existingSpace = await TeamSpace.findOne({
      postType,
      postId
    });

    return !existingSpace;
  }

  /**
   * Get all Builder Spaces for a user (across all teams they're a member of)
   * 
   * @param userId - The ID of the user
   * @returns Array of Builder Space details
   */
  async getUserBuilderSpaces(userId: string): Promise<BuilderSpaceDetails[]> {
    // Get all team memberships for the user
    const memberships = await TeamMember.find({ userId }).lean();

    if (memberships.length === 0) {
      return [];
    }

    // Get all Builder Spaces for those teams
    const spaces: BuilderSpaceDetails[] = [];
    for (const membership of memberships) {
      const space = await this.getBuilderSpaceByPost(
        membership.postType as 'startup' | 'hackathon',
        membership.postId.toString()
      );
      if (space) {
        spaces.push(space);
      }
    }

    return spaces;
  }
}

export const builderSpaceService = new BuilderSpaceService();
