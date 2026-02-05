import { db as defaultDb, applications, teamMembers, teamSpaces, users, startups, hackathons } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export interface TeamMemberDetails {
  id: string;
  userId: string;
  postType: 'startup' | 'hackathon';
  postId: string;
  role: 'founder' | 'member';
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BuilderSpaceDetails {
  id: string;
  postType: 'startup' | 'hackathon';
  postId: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InviteResult {
  teamMember: TeamMemberDetails;
  builderSpace: BuilderSpaceDetails;
  isNewSpace: boolean;
}

export class TeamFormationService {
  private db: BetterSQLite3Database<any>;

  constructor(db?: BetterSQLite3Database<any>) {
    this.db = db || defaultDb;
  }

  /**
   * Invite an applicant to become an official team member
   * This creates a team membership and ensures a Builder Space exists
   * 
   * @param applicationId - The ID of the accepted application
   * @param founderId - The ID of the founder inviting the applicant
   * @returns The team member details, builder space, and whether space is new
   * @throws Error if application not found, not accepted, or unauthorized
   */
  async inviteToBuilderSpace(applicationId: string, founderId: string): Promise<InviteResult> {
    // Get application details
    const application = await this.db
      .select()
      .from(applications)
      .where(eq(applications.id, applicationId))
      .limit(1);

    if (!application.length) {
      throw new Error('Application not found');
    }

    if (application[0].status !== 'accepted') {
      throw new Error('Application must be accepted before inviting to Builder Space');
    }

    // Verify the requester is the founder/creator
    let actualFounderId: string;
    let postName: string;

    if (application[0].postType === 'startup') {
      const startup = await this.db
        .select()
        .from(startups)
        .where(eq(startups.id, application[0].postId))
        .limit(1);

      if (!startup.length) {
        throw new Error('Startup not found');
      }

      actualFounderId = startup[0].founderId;
      postName = startup[0].name;
    } else {
      const hackathon = await this.db
        .select()
        .from(hackathons)
        .where(eq(hackathons.id, application[0].postId))
        .limit(1);

      if (!hackathon.length) {
        throw new Error('Hackathon not found');
      }

      actualFounderId = hackathon[0].creatorId;
      postName = hackathon[0].name;
    }

    if (founderId !== actualFounderId) {
      throw new Error('Access denied: Only the founder can invite team members');
    }

    // Check if applicant is already a team member (duplicate prevention)
    const existingMember = await this.db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.userId, application[0].applicantId),
          eq(teamMembers.postType, application[0].postType),
          eq(teamMembers.postId, application[0].postId)
        )
      )
      .limit(1);

    if (existingMember.length > 0) {
      throw new Error('User is already a team member');
    }

    // Create team member
    const teamMember = await this.createTeamMember(
      application[0].applicantId,
      application[0].postType as 'startup' | 'hackathon',
      application[0].postId,
      'member'
    );

    // Ensure Builder Space exists (create if needed)
    const { space, isNew } = await this.ensureBuilderSpace(
      application[0].postType as 'startup' | 'hackathon',
      application[0].postId,
      postName
    );

    return {
      teamMember,
      builderSpace: space,
      isNewSpace: isNew,
    };
  }

  /**
   * Create a team member with proper role assignment
   * 
   * @param userId - The ID of the user becoming a team member
   * @param postType - The type of post (startup or hackathon)
   * @param postId - The ID of the post
   * @param role - The role of the team member (founder or member)
   * @returns The created team member details
   * @throws Error if validation fails
   */
  async createTeamMember(
    userId: string,
    postType: 'startup' | 'hackathon',
    postId: string,
    role: 'founder' | 'member' = 'member'
  ): Promise<TeamMemberDetails> {
    // Validate user exists
    const user = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length) {
      throw new Error('User not found');
    }

    // Validate post exists
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

    // Check for duplicate membership
    const existingMember = await this.db
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

    if (existingMember.length > 0) {
      throw new Error('User is already a team member');
    }

    // Create team member
    const result = await this.db
      .insert(teamMembers)
      .values({
        userId,
        postType,
        postId,
        role,
      })
      .returning();

    return result[0];
  }

  /**
   * Ensure a Builder Space exists for a team, creating one if needed
   * 
   * @param postType - The type of post (startup or hackathon)
   * @param postId - The ID of the post
   * @param postName - The name of the post (for space naming)
   * @returns The builder space and whether it was newly created
   */
  async ensureBuilderSpace(
    postType: 'startup' | 'hackathon',
    postId: string,
    postName: string
  ): Promise<{ space: BuilderSpaceDetails; isNew: boolean }> {
    // Check if Builder Space already exists
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
      return {
        space: existingSpace[0],
        isNew: false,
      };
    }

    // Create new Builder Space
    const result = await this.db
      .insert(teamSpaces)
      .values({
        postType,
        postId,
        name: `${postName} Builder Space`,
        description: `Collaboration workspace for ${postName}`,
      })
      .returning();

    return {
      space: result[0],
      isNew: true,
    };
  }

  /**
   * Get all team members for a post
   * 
   * @param postType - The type of post (startup or hackathon)
   * @param postId - The ID of the post
   * @returns Array of team member details
   */
  async getTeamMembers(postType: 'startup' | 'hackathon', postId: string): Promise<TeamMemberDetails[]> {
    const members = await this.db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.postType, postType),
          eq(teamMembers.postId, postId)
        )
      );

    return members;
  }

  /**
   * Check if a user is a team member
   * 
   * @param userId - The ID of the user
   * @param postType - The type of post (startup or hackathon)
   * @param postId - The ID of the post
   * @returns True if user is a team member, false otherwise
   */
  async isTeamMember(userId: string, postType: 'startup' | 'hackathon', postId: string): Promise<boolean> {
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
   * Get Builder Space for a post
   * 
   * @param postType - The type of post (startup or hackathon)
   * @param postId - The ID of the post
   * @returns The builder space details or null if not found
   */
  async getBuilderSpace(
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

    return space.length > 0 ? space[0] : null;
  }

  /**
   * Validate if a user has access to a Builder Space
   * 
   * @param userId - The ID of the user
   * @param spaceId - The ID of the Builder Space
   * @returns True if user has access, false otherwise
   */
  async validateBuilderSpaceAccess(userId: string, spaceId: string): Promise<boolean> {
    // Get the space
    const space = await this.db
      .select()
      .from(teamSpaces)
      .where(eq(teamSpaces.id, spaceId))
      .limit(1);

    if (!space.length) {
      return false;
    }

    // Check if user is a team member
    return this.isTeamMember(userId, space[0].postType as 'startup' | 'hackathon', space[0].postId);
  }
}

export const teamFormationService = new TeamFormationService();
