import { db as defaultDb, applications, screeningMessages, users, startups, hackathons } from '../db/index.js';
import { eq, and, or, ne, desc, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

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
  private db: BetterSQLite3Database<any>;

  constructor(db?: BetterSQLite3Database<any>) {
    this.db = db || defaultDb;
  }
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
    const application = await this.db
      .select()
      .from(applications)
      .where(eq(applications.id, applicationId))
      .limit(1);

    if (!application.length) {
      throw new Error('Application not found');
    }

    if (application[0].status !== 'accepted') {
      throw new Error('Application must be accepted to create screening chat');
    }

    // Get founder/creator ID based on post type
    let founderId: string;
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

      founderId = startup[0].founderId;
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

      founderId = hackathon[0].creatorId;
      postName = hackathon[0].name;
    }

    // Return screening chat details
    // Note: The screening chat is implicitly created by the accepted application
    // No separate chat entity is needed - the application itself represents the chat
    return {
      id: application[0].id,
      applicationId: application[0].id,
      founderId,
      applicantId: application[0].applicantId,
      postType: application[0].postType as 'startup' | 'hackathon',
      postId: application[0].postId,
      postName,
      status: application[0].status!,
      createdAt: application[0].createdAt || new Date(),
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
    const application = await this.db
      .select()
      .from(applications)
      .where(eq(applications.id, applicationId))
      .limit(1);

    if (!application.length) {
      throw new Error('Screening chat not found');
    }

    // Get founder/creator ID and post name based on post type
    let founderId: string;
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

      founderId = startup[0].founderId;
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

      founderId = hackathon[0].creatorId;
      postName = hackathon[0].name;
    }

    // Authorization check: only founder and applicant can access
    if (userId !== founderId && userId !== application[0].applicantId) {
      throw new Error('Access denied: You are not authorized to access this screening chat');
    }

    // Get founder and applicant details
    const [founderUser, applicantUser] = await Promise.all([
      this.db.select().from(users).where(eq(users.id, founderId)).limit(1),
      this.db.select().from(users).where(eq(users.id, application[0].applicantId)).limit(1),
    ]);

    return {
      id: application[0].id,
      applicationId: application[0].id,
      founderId,
      applicantId: application[0].applicantId,
      postType: application[0].postType as 'startup' | 'hackathon',
      postId: application[0].postId,
      postName,
      status: application[0].status!,
      createdAt: application[0].createdAt || new Date(),
      founder: founderUser[0] ? {
        id: founderUser[0].id,
        name: founderUser[0].name,
        email: founderUser[0].email,
        avatar: founderUser[0].avatar || undefined,
      } : undefined,
      applicant: applicantUser[0] ? {
        id: applicantUser[0].id,
        name: applicantUser[0].name,
        email: applicantUser[0].email,
        avatar: applicantUser[0].avatar || undefined,
      } : undefined,
      application: {
        post: {
          name: postName,
          postType: application[0].postType,
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
    const applicantApplications = await this.db
      .select()
      .from(applications)
      .where(
        and(
          eq(applications.applicantId, userId),
          eq(applications.status, 'accepted')
        )
      );

    // Get all accepted applications for user's posts (as founder)
    const userStartups = await this.db
      .select({ id: startups.id })
      .from(startups)
      .where(eq(startups.founderId, userId));

    const userHackathons = await this.db
      .select({ id: hackathons.id })
      .from(hackathons)
      .where(eq(hackathons.creatorId, userId));

    const startupIds = userStartups.map((s: any) => s.id);
    const hackathonIds = userHackathons.map((h: any) => h.id);

    let founderApplications: typeof applicantApplications = [];

    if (startupIds.length > 0 || hackathonIds.length > 0) {
      const conditions = [];
      if (startupIds.length > 0) {
        conditions.push(
          and(
            eq(applications.postType, 'startup'),
            or(...startupIds.map((id: any) => eq(applications.postId, id)))
          )
        );
      }
      if (hackathonIds.length > 0) {
        conditions.push(
          and(
            eq(applications.postType, 'hackathon'),
            or(...hackathonIds.map((id: any) => eq(applications.postId, id)))
          )
        );
      }

      founderApplications = await this.db
        .select()
        .from(applications)
        .where(
          and(
            eq(applications.status, 'accepted'),
            or(...conditions)
          )
        );
    }

    // Combine and deduplicate
    const allApplications = [...applicantApplications, ...founderApplications];
    const uniqueApplications = Array.from(
      new Map(allApplications.map(app => [app.id, app])).values()
    );

    // Convert to screening chat details
    const screeningChats = await Promise.all(
      uniqueApplications.map(async (app) => {
        let founderId: string;
        let postName: string;

        if (app.postType === 'startup') {
          const startup = await this.db
            .select()
            .from(startups)
            .where(eq(startups.id, app.postId))
            .limit(1);

          founderId = startup[0]?.founderId || '';
          postName = startup[0]?.name || '';
        } else {
          const hackathon = await this.db
            .select()
            .from(hackathons)
            .where(eq(hackathons.id, app.postId))
            .limit(1);

          founderId = hackathon[0]?.creatorId || '';
          postName = hackathon[0]?.name || '';
        }

        // Get founder and applicant details
        const [founderUser, applicantUser] = await Promise.all([
          this.db.select().from(users).where(eq(users.id, founderId)).limit(1),
          this.db.select().from(users).where(eq(users.id, app.applicantId)).limit(1),
        ]);

        // Get last message for this chat
        const lastMessage = await this.db
          .select()
          .from(screeningMessages)
          .where(eq(screeningMessages.chatId, app.id))
          .orderBy(sql`${screeningMessages.createdAt} DESC`)
          .limit(1);

        // Get unread message count (messages sent by the other person that were created after user last viewed)
        const unreadMessages = await this.db
          .select()
          .from(screeningMessages)
          .where(
            and(
              eq(screeningMessages.chatId, app.id),
              ne(screeningMessages.senderId, userId) // Messages from the other person
            )
          );

        return {
          id: app.id,
          applicationId: app.id,
          founderId,
          applicantId: app.applicantId,
          postType: app.postType as 'startup' | 'hackathon',
          postId: app.postId,
          postName,
          status: app.status!,
          createdAt: app.createdAt || new Date(),
          founder: founderUser[0] ? {
            id: founderUser[0].id,
            name: founderUser[0].name,
            email: founderUser[0].email,
            avatar: founderUser[0].avatar || undefined,
          } : undefined,
          applicant: applicantUser[0] ? {
            id: applicantUser[0].id,
            name: applicantUser[0].name,
            email: applicantUser[0].email,
            avatar: applicantUser[0].avatar || undefined,
          } : undefined,
          application: {
            post: {
              name: postName,
              postType: app.postType,
            },
          },
          lastMessage: lastMessage[0] ? {
            content: lastMessage[0].content,
            createdAt: lastMessage[0].createdAt,
            senderId: lastMessage[0].senderId,
          } : undefined,
          unreadCount: unreadMessages.length,
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
