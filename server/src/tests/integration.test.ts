import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, users, startups, applications, teamSpaces, teamMembers, spaceMessages, spaceLinks, spaceTasks } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { screeningChatService } from '../services/ScreeningChatService.js';
import { screeningMessageService } from '../services/ScreeningMessageService.js';
import { teamFormationService } from '../services/TeamFormationService.js';
import { builderSpaceService } from '../services/BuilderSpaceService.js';
import { groupChatService } from '../services/GroupChatService.js';
import { sharedLinkService } from '../services/SharedLinkService.js';
import { taskService } from '../services/TaskService.js';
import { MessageBroadcastService } from '../services/MessageBroadcastService.js';

/**
 * Integration Tests for End-to-End Workflows
 * 
 * Tests complete workflows:
 * - Screening to team formation flow
 * - Full collaboration workflow within Builder Spaces
 * - Real-time features across multiple users
 * 
 * Requirements: All requirements
 */
describe('Integration Tests: End-to-End Workflows', () => {
  let broadcastService: MessageBroadcastService;
  const testUsers: string[] = [];
  const testStartups: string[] = [];
  const testApplications: string[] = [];
  const testSpaces: string[] = [];

  beforeEach(() => {
    broadcastService = new MessageBroadcastService(db);
  });

  afterEach(async () => {
    // Clean up test data
    for (const spaceId of testSpaces) {
      await db.delete(spaceMessages).where(eq(spaceMessages.spaceId, spaceId));
      await db.delete(spaceLinks).where(eq(spaceLinks.spaceId, spaceId));
      await db.delete(spaceTasks).where(eq(spaceTasks.spaceId, spaceId));
      await db.delete(teamSpaces).where(eq(teamSpaces.id, spaceId));
    }
    for (const appId of testApplications) {
      await db.delete(applications).where(eq(applications.id, appId));
    }
    for (const startupId of testStartups) {
      await db.delete(startups).where(eq(startups.id, startupId));
    }
    for (const userId of testUsers) {
      await db.delete(teamMembers).where(eq(teamMembers.userId, userId));
      await db.delete(users).where(eq(users.id, userId));
    }
    testUsers.length = 0;
    testStartups.length = 0;
    testApplications.length = 0;
    testSpaces.length = 0;
  });

  /**
   * Helper to create a test user
   */
  async function createUser(suffix: string): Promise<string> {
    const userId = `user-${Date.now()}-${suffix}`;
    testUsers.push(userId);

    await db.insert(users).values({
      id: userId,
      email: `${userId}@test.com`,
      name: `Test User ${suffix}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return userId;
  }

  /**
   * Helper to create a test startup
   */
  async function createStartup(founderId: string): Promise<string> {
    const startupId = `startup-${Date.now()}`;
    testStartups.push(startupId);

    await db.insert(startups).values({
      id: startupId,
      userId: founderId,
      title: 'Test Startup',
      description: 'A test startup for integration testing',
      stage: 'idea',
      lookingFor: ['developer', 'designer'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return startupId;
  }

  /**
   * Helper to create an application
   */
  async function createApplication(startupId: string, applicantId: string): Promise<string> {
    const appId = `app-${Date.now()}`;
    testApplications.push(appId);

    await db.insert(applications).values({
      id: appId,
      userId: applicantId,
      postType: 'startup',
      postId: startupId,
      role: 'developer',
      message: 'I would like to join your team',
      status: 'accepted',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return appId;
  }

  describe('Complete Screening to Team Formation Flow', () => {
    it('should complete full workflow from application to team formation', async () => {
      // Step 1: Create founder and applicant
      const founderId = await createUser('founder');
      const applicantId = await createUser('applicant');

      // Step 2: Create startup
      const startupId = await createStartup(founderId);

      // Step 3: Create and accept application
      const applicationId = await createApplication(startupId, applicantId);

      // Step 4: Create screening chat
      const screeningChat = await screeningChatService.createScreeningChat(
        applicationId,
        founderId
      );

      expect(screeningChat).toBeDefined();
      expect(screeningChat.applicationId).toBe(applicationId);

      // Step 5: Exchange messages in screening chat
      const message1 = await screeningMessageService.sendScreeningMessage({
        applicationId,
        senderId: founderId,
        content: 'Hi! Thanks for applying. Tell me about your experience.',
      });

      expect(message1).toBeDefined();
      expect(message1.content).toContain('experience');

      const message2 = await screeningMessageService.sendScreeningMessage({
        applicationId,
        senderId: applicantId,
        content: 'I have 5 years of experience in web development.',
      });

      expect(message2).toBeDefined();

      // Verify message history
      const messages = await screeningMessageService.getScreeningMessages(
        applicationId,
        founderId
      );

      expect(messages).toHaveLength(2);
      expect(messages[0].senderId).toBe(founderId);
      expect(messages[1].senderId).toBe(applicantId);

      // Step 6: Founder invites applicant to team
      const teamMember = await teamFormationService.inviteToBuilderSpace(
        applicationId,
        founderId
      );

      expect(teamMember).toBeDefined();
      expect(teamMember.userId).toBe(applicantId);
      expect(teamMember.postType).toBe('startup');
      expect(teamMember.postId).toBe(startupId);

      // Step 7: Verify Builder Space was created
      const builderSpace = await builderSpaceService.getBuilderSpaceByPost(
        'startup',
        startupId
      );

      expect(builderSpace).toBeDefined();
      testSpaces.push(builderSpace!.id);

      // Step 8: Verify both users can access Builder Space
      const founderAccess = await builderSpaceService.getBuilderSpace(
        builderSpace!.id,
        founderId
      );
      expect(founderAccess).toBeDefined();

      const applicantAccess = await builderSpaceService.getBuilderSpace(
        builderSpace!.id,
        applicantId
      );
      expect(applicantAccess).toBeDefined();

      // Step 9: Verify team members
      const members = await builderSpaceService.getTeamMembers(builderSpace!.id);
      expect(members).toHaveLength(2);
      expect(members.map(m => m.userId)).toContain(founderId);
      expect(members.map(m => m.userId)).toContain(applicantId);
    });

    it('should prevent unauthorized access during screening', async () => {
      const founderId = await createUser('founder');
      const applicantId = await createUser('applicant');
      const unauthorizedId = await createUser('unauthorized');

      const startupId = await createStartup(founderId);
      const applicationId = await createApplication(startupId, applicantId);

      await screeningChatService.createScreeningChat(applicationId, founderId);

      // Unauthorized user should not be able to access screening chat
      await expect(
        screeningChatService.getScreeningChat(applicationId, unauthorizedId)
      ).rejects.toThrow('Access denied');

      // Unauthorized user should not be able to send messages
      await expect(
        screeningMessageService.sendScreeningMessage({
          applicationId,
          senderId: unauthorizedId,
          content: 'Unauthorized message',
        })
      ).rejects.toThrow('Access denied');
    });
  });

  describe('Full Collaboration Workflow within Builder Spaces', () => {
    it('should support complete collaboration workflow', async () => {
      // Setup: Create team with Builder Space
      const founderId = await createUser('founder');
      const member1Id = await createUser('member1');
      const member2Id = await createUser('member2');

      const startupId = await createStartup(founderId);

      // Create Builder Space
      const builderSpace = await builderSpaceService.createBuilderSpace(
        'startup',
        startupId,
        'Test Team Space'
      );
      testSpaces.push(builderSpace.id);

      // Add team members
      await db.insert(teamMembers).values([
        {
          id: `tm-founder-${Date.now()}`,
          userId: founderId,
          postType: 'startup',
          postId: startupId,
          role: 'founder',
          joinedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: `tm-member1-${Date.now()}`,
          userId: member1Id,
          postType: 'startup',
          postId: startupId,
          role: 'member',
          joinedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: `tm-member2-${Date.now()}`,
          userId: member2Id,
          postType: 'startup',
          postId: startupId,
          role: 'member',
          joinedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Test 1: Group messaging
      const msg1 = await groupChatService.sendGroupMessage(
        builderSpace.id,
        founderId,
        'Welcome to the team!'
      );
      expect(msg1).toBeDefined();

      const msg2 = await groupChatService.sendGroupMessage(
        builderSpace.id,
        member1Id,
        'Thanks! Excited to be here.'
      );
      expect(msg2).toBeDefined();

      const groupMessages = await groupChatService.getGroupMessages(
        builderSpace.id,
        founderId
      );
      expect(groupMessages).toHaveLength(2);

      // Test 2: Shared links
      const link1 = await sharedLinkService.addSharedLink(
        builderSpace.id,
        founderId,
        'GitHub Repository',
        'https://github.com/test/repo'
      );
      expect(link1).toBeDefined();

      const link2 = await sharedLinkService.addSharedLink(
        builderSpace.id,
        member1Id,
        'Figma Design',
        'https://figma.com/test'
      );
      expect(link2).toBeDefined();

      const links = await sharedLinkService.getSharedLinks(
        builderSpace.id,
        founderId
      );
      expect(links).toHaveLength(2);

      // Test 3: Task management
      const task1 = await taskService.createTask(
        builderSpace.id,
        founderId,
        'Setup project structure',
        'Initialize the repository and setup basic structure'
      );
      expect(task1).toBeDefined();

      const task2 = await taskService.createTask(
        builderSpace.id,
        member1Id,
        'Design landing page',
        'Create mockups for the landing page'
      );
      expect(task2).toBeDefined();

      const tasks = await taskService.getTasks(builderSpace.id, founderId);
      expect(tasks).toHaveLength(2);

      // Test 4: Task completion
      const updatedTask = await taskService.updateTaskStatus(
        task1.id,
        founderId,
        true
      );
      expect(updatedTask.completed).toBe(1);

      // Test 5: Creator ownership - only creator can delete
      await expect(
        sharedLinkService.removeSharedLink(link1.id, member1Id)
      ).rejects.toThrow('not authorized');

      await sharedLinkService.removeSharedLink(link1.id, founderId);
      const linksAfterDelete = await sharedLinkService.getSharedLinks(
        builderSpace.id,
        founderId
      );
      expect(linksAfterDelete).toHaveLength(1);

      // Test 6: Task deletion by creator
      await taskService.deleteTask(task2.id, member1Id);
      const tasksAfterDelete = await taskService.getTasks(
        builderSpace.id,
        founderId
      );
      expect(tasksAfterDelete).toHaveLength(1);
    });

    it('should enforce authorization for all Builder Space operations', async () => {
      const founderId = await createUser('founder');
      const memberId = await createUser('member');
      const outsiderId = await createUser('outsider');

      const startupId = await createStartup(founderId);
      const builderSpace = await builderSpaceService.createBuilderSpace(
        'startup',
        startupId,
        'Private Space'
      );
      testSpaces.push(builderSpace.id);

      // Add only founder and member
      await db.insert(teamMembers).values([
        {
          id: `tm-founder-${Date.now()}`,
          userId: founderId,
          postType: 'startup',
          postId: startupId,
          role: 'founder',
          joinedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: `tm-member-${Date.now()}`,
          userId: memberId,
          postType: 'startup',
          postId: startupId,
          role: 'member',
          joinedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Outsider should not be able to access Builder Space
      await expect(
        builderSpaceService.getBuilderSpace(builderSpace.id, outsiderId)
      ).rejects.toThrow();

      // Outsider should not be able to send messages
      await expect(
        groupChatService.sendGroupMessage(
          builderSpace.id,
          outsiderId,
          'Unauthorized message'
        )
      ).rejects.toThrow();

      // Outsider should not be able to add links
      await expect(
        sharedLinkService.addSharedLink(
          builderSpace.id,
          outsiderId,
          'Unauthorized Link',
          'https://example.com'
        )
      ).rejects.toThrow();

      // Outsider should not be able to create tasks
      await expect(
        taskService.createTask(
          builderSpace.id,
          outsiderId,
          'Unauthorized Task'
        )
      ).rejects.toThrow();
    });
  });

  describe('Real-time Features Across Multiple Users', () => {
    it('should track online/offline status', () => {
      const user1 = 'user-online-1';
      const user2 = 'user-online-2';

      // Initially no users online
      expect(broadcastService.getOnlineUserCount()).toBe(0);
      expect(broadcastService.isUserOnline(user1)).toBe(false);

      // Note: Full WebSocket testing would require actual WebSocket connections
      // This test verifies the service methods exist and work
      expect(broadcastService.getOnlineUsers()).toEqual([]);
    });

    it('should queue messages for offline users', () => {
      const userId = 'user-offline-test';

      // User is offline, so message should be queued
      const sent = broadcastService.sendToUser(userId, {
        type: 'group_message' as any,
        payload: { content: 'Test message' },
        timestamp: new Date(),
      });

      expect(sent).toBe(false); // Not sent because user is offline

      // Check queued message count
      const queuedCount = broadcastService.getQueuedMessageCount(userId);
      expect(queuedCount).toBe(1);
    });

    it('should broadcast to multiple users', async () => {
      const user1 = 'user-broadcast-1';
      const user2 = 'user-broadcast-2';
      const user3 = 'user-broadcast-3';

      const result = broadcastService.broadcastToUsers(
        [user1, user2, user3],
        {
          type: 'group_message' as any,
          payload: { content: 'Broadcast message' },
          timestamp: new Date(),
        }
      );

      // All users are offline, so all should be queued
      expect(result.online).toBe(0);
      expect(result.offline).toBe(3);

      // Verify messages were queued
      expect(broadcastService.getQueuedMessageCount(user1)).toBe(1);
      expect(broadcastService.getQueuedMessageCount(user2)).toBe(1);
      expect(broadcastService.getQueuedMessageCount(user3)).toBe(1);
    });
  });

  describe('Data Persistence and Consistency', () => {
    it('should maintain referential integrity across all tables', async () => {
      const founderId = await createUser('founder');
      const applicantId = await createUser('applicant');
      const startupId = await createStartup(founderId);
      const applicationId = await createApplication(startupId, applicantId);

      // Create screening chat
      await screeningChatService.createScreeningChat(applicationId, founderId);

      // Send messages
      await screeningMessageService.sendScreeningMessage({
        applicationId,
        senderId: founderId,
        content: 'Test message',
      });

      // Form team
      await teamFormationService.inviteToBuilderSpace(applicationId, founderId);

      // Get Builder Space
      const builderSpace = await builderSpaceService.getBuilderSpaceByPost(
        'startup',
        startupId
      );
      testSpaces.push(builderSpace!.id);

      // Add collaboration data
      await groupChatService.sendGroupMessage(
        builderSpace!.id,
        founderId,
        'Team message'
      );

      await sharedLinkService.addSharedLink(
        builderSpace!.id,
        founderId,
        'Test Link',
        'https://example.com'
      );

      await taskService.createTask(
        builderSpace!.id,
        founderId,
        'Test Task'
      );

      // Verify all data exists and is connected
      const messages = await groupChatService.getGroupMessages(
        builderSpace!.id,
        founderId
      );
      expect(messages).toHaveLength(1);

      const links = await sharedLinkService.getSharedLinks(
        builderSpace!.id,
        founderId
      );
      expect(links).toHaveLength(1);

      const tasks = await taskService.getTasks(builderSpace!.id, founderId);
      expect(tasks).toHaveLength(1);

      const members = await builderSpaceService.getTeamMembers(builderSpace!.id);
      expect(members).toHaveLength(2);
    });

    it('should handle concurrent operations safely', async () => {
      const founderId = await createUser('founder');
      const startupId = await createStartup(founderId);
      const builderSpace = await builderSpaceService.createBuilderSpace(
        'startup',
        startupId,
        'Concurrent Test Space'
      );
      testSpaces.push(builderSpace.id);

      await db.insert(teamMembers).values({
        id: `tm-${Date.now()}`,
        userId: founderId,
        postType: 'startup',
        postId: startupId,
        role: 'founder',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Send multiple messages concurrently
      const messagePromises = Array.from({ length: 10 }, (_, i) =>
        groupChatService.sendGroupMessage(
          builderSpace.id,
          founderId,
          `Concurrent message ${i}`
        )
      );

      const messages = await Promise.all(messagePromises);
      expect(messages).toHaveLength(10);

      // Verify all messages were saved
      const savedMessages = await groupChatService.getGroupMessages(
        builderSpace.id,
        founderId
      );
      expect(savedMessages).toHaveLength(10);

      // Verify no duplicate messages
      const messageIds = savedMessages.map(m => m.id);
      const uniqueIds = new Set(messageIds);
      expect(uniqueIds.size).toBe(10);
    });
  });

  describe('Error Handling in Workflows', () => {
    it('should handle errors gracefully without corrupting data', async () => {
      const founderId = await createUser('founder');
      const startupId = await createStartup(founderId);
      const builderSpace = await builderSpaceService.createBuilderSpace(
        'startup',
        startupId,
        'Error Test Space'
      );
      testSpaces.push(builderSpace.id);

      await db.insert(teamMembers).values({
        id: `tm-${Date.now()}`,
        userId: founderId,
        postType: 'startup',
        postId: startupId,
        role: 'founder',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Add a valid message
      await groupChatService.sendGroupMessage(
        builderSpace.id,
        founderId,
        'Valid message'
      );

      // Try to add invalid data (should fail)
      await expect(
        groupChatService.sendGroupMessage(builderSpace.id, founderId, '')
      ).rejects.toThrow();

      // Verify valid data is still intact
      const messages = await groupChatService.getGroupMessages(
        builderSpace.id,
        founderId
      );
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Valid message');
    });
  });
});
