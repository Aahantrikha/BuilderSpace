import { Application, TeamMember, TeamSpace, User, Startup, Hackathon } from '../db/index.js';

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
    const application = await Application.findById(applicationId);

    if (!application) {
      throw new Error('Application not found');
    }

    if (application.status !== 'accepted') {
      throw new Error('Application must be accepted before inviting to Builder Space');
    }

    // Verify the requester is the founder/creator
    let actualFounderId: string;
    let postName: string;

    if (application.postType === 'startup') {
      const startup = await Startup.findById(application.postId);

      if (!startup) {
        throw new Error('Startup not found');
      }

      actualFounderId = startup.founderId.toString();
      postName = startup.name;
    } else {
      const hackathon = await Hackathon.findById(application.postId);

      if (!hackathon) {
        throw new Error('Hackathon not found');
      }

      actualFounderId = hackathon.creatorId.toString();
      postName = hackathon.name;
    }

    if (founderId !== actualFounderId) {
      throw new Error('Access denied: Only the founder can invite team members');
    }

    // Check if applicant is already a team member (duplicate prevention)
    const existingMember = await TeamMember.findOne({
      userId: application.applicantId,
      postType: application.postType,
      postId: application.postId
    });

    if (existingMember) {
      throw new Error('User is already a team member');
    }

    // Create team member
    const teamMember = await this.createTeamMember(
      application.applicantId.toString(),
      application.postType as 'startup' | 'hackathon',
      application.postId.toString(),
      'member'
    );

    // Ensure Builder Space exists (create if needed)
    const { space, isNew } = await this.ensureBuilderSpace(
      application.postType as 'startup' | 'hackathon',
      application.postId.toString(),
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
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Validate post exists
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

    // Check for duplicate membership
    const existingMember = await TeamMember.findOne({
      userId,
      postType,
      postId
    });

    if (existingMember) {
      throw new Error('User is already a team member');
    }

    // Create team member
    const result = await TeamMember.create({
      userId,
      postType,
      postId,
      role,
      joinedAt: new Date(),
    });

    return result.toObject() as TeamMemberDetails;
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
    const existingSpace = await TeamSpace.findOne({
      postType,
      postId
    });

    if (existingSpace) {
      return {
        space: existingSpace.toObject() as BuilderSpaceDetails,
        isNew: false,
      };
    }

    // Create new Builder Space
    const result = await TeamSpace.create({
      postType,
      postId,
      name: `${postName} Builder Space`,
      description: `Collaboration workspace for ${postName}`,
    });

    return {
      space: result.toObject() as BuilderSpaceDetails,
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
    const members = await TeamMember.find({
      postType,
      postId
    }).lean();

    return members.map((m: any) => ({
      ...m,
      id: m._id.toString(),
      userId: m.userId.toString(),
      postId: m.postId.toString(),
    })) as TeamMemberDetails[];
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
    const member = await TeamMember.findOne({
      userId,
      postType,
      postId
    });

    return !!member;
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
    const space = await TeamSpace.findOne({
      postType,
      postId
    });

    return space ? (space.toObject() as BuilderSpaceDetails) : null;
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
    const space = await TeamSpace.findById(spaceId);

    if (!space) {
      return false;
    }

    // Check if user is a team member
    return this.isTeamMember(userId, space.postType as 'startup' | 'hackathon', space.postId.toString());
  }
}

export const teamFormationService = new TeamFormationService();
