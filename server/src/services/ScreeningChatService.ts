import { Application, ScreeningMessage, User, Startup, Hackathon } from '../db/index.js';

export interface ScreeningChatParticipants {
  founderId: string;
  applicantId: string;
}

export interface ScreeningChatDetails {
  id: string;
  applicationId: string;
  founderId: string;
  applicantId: string;
  postType: 'startup' | 'hackathon';
  postId: string;
  postName: string;
  status: string;
  createdAt: Date;
  founder?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  applicant?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  application?: {
    post?: {
      name: string;
      postType: string;
    };
  };
}

export class ScreeningChatService {
  /**
   * Create a screening chat when an application is accepted
   * This is triggered automatically when a founder accepts an application
   * 
   * @param applicationId - The ID of the accepted application
   * @returns The screening chat details including participants
   * @throws Error if application not found or not accepted
   */
  async createScreeningChat(applicationId: string): Promise<ScreeningChatDetails> {
    // Get application details
    const application = await Application.findById(applicationId);

    if (!application) {
      throw new Error('Application not found');
    }

    if (application.status !== 'accepted') {
      throw new Error('Application must be accepted to create screening chat');
    }

    // Get founder/creator ID based on post type
    let founderId: string;
    let postName: string;

    if (application.postType === 'startup') {
      const startup = await Startup.findById(application.postId);

      if (!startup) {
        throw new Error('Startup not found');
      }

      founderId = startup.founderId.toString();
      postName = startup.name;
    } else {
      const hackathon = await Hackathon.findById(application.postId);

      if (!hackathon) {
        throw new Error('Hackathon not found');
      }

      founderId = hackathon.creatorId.toString();
      postName = hackathon.name;
    }

    // Return screening chat details
    // Note: The screening chat is implicitly created by the accepted application
    // No separate chat entity is needed - the application itself represents the chat
    return {
      id: application.id,
      applicationId: application.id,
      founderId,
      applicantId: application.applicantId.toString(),
      postType: application.postType as 'startup' | 'hackathon',
      postId: application.postId.toString(),
      postName,
      status: application.status,
      createdAt: application.createdAt,
    };
  }

  /**
   * Get screening chat details with authorization check
   * Only the founder and applicant can access the screening chat
   * 
   * @param applicationId - The ID of the application (screening chat)
   * @param userId - The ID of the user requesting access
   * @returns The screening chat details
   * @throws Error if unauthorized or chat not found
   */
  async getScreeningChat(applicationId: string, userId: string): Promise<ScreeningChatDetails> {
    // Get application details
    const application = await Application.findById(applicationId);

    if (!application) {
      throw new Error('Screening chat not found');
    }

    // Get founder/creator ID and post name based on post type
    let founderId: string;
    let postName: string;

    if (application.postType === 'startup') {
      const startup = await Startup.findById(application.postId);

      if (!startup) {
        throw new Error('Startup not found');
      }

      founderId = startup.founderId.toString();
      postName = startup.name;
    } else {
      const hackathon = await Hackathon.findById(application.postId);

      if (!hackathon) {
        throw new Error('Hackathon not found');
      }

      founderId = hackathon.creatorId.toString();
      postName = hackathon.name;
    }

    // Authorization check: only founder and applicant can access
    if (userId !== founderId && userId !== application.applicantId.toString()) {
      throw new Error('Access denied: You are not authorized to access this screening chat');
    }

    // Get founder and applicant details
    const [founderUser, applicantUser] = await Promise.all([
      User.findById(founderId).lean(),
      User.findById(application.applicantId).lean(),
    ]);

    return {
      id: application.id,
      applicationId: application.id,
      founderId,
      applicantId: application.applicantId.toString(),
      postType: application.postType as 'startup' | 'hackathon',
      postId: application.postId.toString(),
      postName,
      status: application.status,
      createdAt: application.createdAt,
      founder: founderUser ? {
        id: founderUser.id,
        name: founderUser.name,
        email: founderUser.email,
        avatar: founderUser.avatar || undefined,
      } : undefined,
      applicant: applicantUser ? {
        id: applicantUser.id,
        name: applicantUser.name,
        email: applicantUser.email,
        avatar: applicantUser.avatar || undefined,
      } : undefined,
      application: {
        post: {
          name: postName,
          postType: application.postType,
        },
      },
    };
  }

  /**
   * Get all screening chats for a user (as founder or applicant)
   * 
   * @param userId - The ID of the user
   * @returns Array of screening chat details
   */
  async getUserScreeningChats(userId: string): Promise<ScreeningChatDetails[]> {
    // Get all accepted applications where user is applicant
    const applicantApplications = await Application.find({
      applicantId: userId,
      status: 'accepted'
    }).lean();

    // Get all accepted applications for user's posts (as founder)
    const userStartups = await Startup.find({ founderId: userId }).select('id').lean();
    const userHackathons = await Hackathon.find({ creatorId: userId }).select('id').lean();

    const startupIds = userStartups.map(s => s.id);
    const hackathonIds = userHackathons.map(h => h.id);

    let founderApplications: any[] = [];

    if (startupIds.length > 0 || hackathonIds.length > 0) {
      const conditions = [];
      if (startupIds.length > 0) {
        conditions.push({ postType: 'startup', postId: { $in: startupIds } });
      }
      if (hackathonIds.length > 0) {
        conditions.push({ postType: 'hackathon', postId: { $in: hackathonIds } });
      }

      founderApplications = await Application.find({
        status: 'accepted',
        $or: conditions
      }).lean();
    }

    // Combine and deduplicate
    const allApplications = [...applicantApplications, ...founderApplications];
    const uniqueApplications = Array.from(
      new Map(allApplications.map(app => [app.id || app._id.toString(), app])).values()
    );

    // Convert to screening chat details
    const screeningChats = await Promise.all(
      uniqueApplications.map(async (app: any) => {
        let founderId: string;
        let postName: string;

        if (app.postType === 'startup') {
          const startup = await Startup.findById(app.postId).lean();
          founderId = startup?.founderId?.toString() || '';
          postName = startup?.name || '';
        } else {
          const hackathon = await Hackathon.findById(app.postId).lean();
          founderId = hackathon?.creatorId?.toString() || '';
          postName = hackathon?.name || '';
        }

        // Get founder and applicant details
        const [founderUser, applicantUser] = await Promise.all([
          User.findById(founderId).lean(),
          User.findById(app.applicantId).lean(),
        ]);

        // Get last message for this chat
        const lastMessage = await ScreeningMessage.findOne({ chatId: app.id || app._id })
          .sort({ createdAt: -1 })
          .limit(1)
          .lean();

        // Get unread message count (messages sent by the other person)
        const unreadCount = await ScreeningMessage.countDocuments({
          chatId: app.id || app._id,
          senderId: { $ne: userId }
        });

        return {
          id: app.id || app._id.toString(),
          applicationId: app.id || app._id.toString(),
          founderId,
          applicantId: app.applicantId?.toString() || '',
          postType: app.postType as 'startup' | 'hackathon',
          postId: app.postId,
          postName,
          status: app.status,
          createdAt: app.createdAt || new Date(),
          founder: founderUser ? {
            id: founderUser.id,
            name: founderUser.name,
            email: founderUser.email,
            avatar: founderUser.avatar || undefined,
          } : undefined,
          applicant: applicantUser ? {
            id: applicantUser.id,
            name: applicantUser.name,
            email: applicantUser.email,
            avatar: applicantUser.avatar || undefined,
          } : undefined,
          application: {
            post: {
              name: postName,
              postType: app.postType,
            },
          },
          lastMessage: lastMessage ? {
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            senderId: lastMessage.senderId,
          } : undefined,
          unreadCount,
        };
      })
    );

    return screeningChats;
  }

  /**
   * Validate if a user is authorized to access a screening chat
   * 
   * @param applicationId - The ID of the application (screening chat)
   * @param userId - The ID of the user to validate
   * @returns Object with authorization status and participants
   */
  async validateScreeningChatAccess(
    applicationId: string,
    userId: string
  ): Promise<{ authorized: boolean; participants?: ScreeningChatParticipants }> {
    try {
      const chat = await this.getScreeningChat(applicationId, userId);
      return {
        authorized: true,
        participants: {
          founderId: chat.founderId,
          applicantId: chat.applicantId,
        },
      };
    } catch (error) {
      return { authorized: false };
    }
  }
}

export const screeningChatService = new ScreeningChatService();
