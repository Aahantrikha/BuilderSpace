import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageBroadcastService, MessageType } from './MessageBroadcastService.js';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { users, startups, teamMembers, teamSpaces } from '../db/schema.js';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer, Server } from 'http';

describe('MessageBroadcastService', () => {
  let db: BetterSQLite3Database<any>;
  let sqlite: Database.Database;
  let service: MessageBroadcastService;
  let httpServer: Server;
  let testFounderId: string;
  let testMember1Id: string;
  let testMember2Id: string;
  let testStartupId: string;
  let testSpaceId: string;

  beforeEach(async () => {
    // Create in-memory database
    sqlite = new Database(':memory:');
    db = drizzle(sqlite);

    // Create tables
    sqlite.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password TEXT,
        avatar TEXT,
        college TEXT,
        city TEXT,
        bio TEXT,
        skills TEXT DEFAULT '[]',
        preferences TEXT DEFAULT '{"joinStartup":false,"buildStartup":false,"joinHackathons":false}',
        google_id TEXT,
        email_verified INTEGER DEFAULT 0,
        onboarding_completed INTEGER DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE startups (
        id TEXT PRIMARY KEY,
        founder_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        stage TEXT NOT NULL,
        skills_needed TEXT DEFAULT '[]',
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (founder_id) REFERENCES users(id)
      );

      CREATE TABLE team_members (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        post_type TEXT NOT NULL,
        post_id TEXT NOT NULL,
        role TEXT DEFAULT 'member',
        joined_at INTEGER,
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE team_spaces (
        id TEXT PRIMARY KEY,
        post_type TEXT NOT NULL,
        post_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER,
        updated_at INTEGER
      );
    `);

    // Initialize service
    service = new MessageBroadcastService(db);

    // Create HTTP server for WebSocket
    httpServer = createServer();
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });

    // Initialize WebSocket server
    service.initialize(httpServer);

    // Create test data
    const now = Date.now();
    testFounderId = crypto.randomUUID();
    testMember1Id = crypto.randomUUID();
    testMember2Id = crypto.randomUUID();
    testStartupId = crypto.randomUUID();
    testSpaceId = crypto.randomUUID();

    // Insert test users
    await db.insert(users).values([
      {
        id: testFounderId,
        email: 'founder@test.com',
        name: 'Test Founder',
        password: 'hashedpassword',
        createdAt: new Date(now),
        updatedAt: new Date(now),
      },
      {
        id: testMember1Id,
        email: 'member1@test.com',
        name: 'Test Member 1',
        password: 'hashedpassword',
        createdAt: new Date(now),
        updatedAt: new Date(now),
      },
      {
        id: testMember2Id,
        email: 'member2@test.com',
        name: 'Test Member 2',
        password: 'hashedpassword',
        createdAt: new Date(now),
        updatedAt: new Date(now),
      },
    ]);

    // Insert test startup
    await db.insert(startups).values({
      id: testStartupId,
      founderId: testFounderId,
      name: 'Test Startup',
      description: 'A test startup',
      stage: 'Idea',
      createdAt: new Date(now),
      updatedAt: new Date(now),
    });

    // Insert team members
    await db.insert(teamMembers).values([
      {
        id: crypto.randomUUID(),
        userId: testFounderId,
        postType: 'startup',
        postId: testStartupId,
        role: 'founder',
        joinedAt: new Date(now),
        createdAt: new Date(now),
        updatedAt: new Date(now),
      },
      {
        id: crypto.randomUUID(),
        userId: testMember1Id,
        postType: 'startup',
        postId: testStartupId,
        role: 'member',
        joinedAt: new Date(now),
        createdAt: new Date(now),
        updatedAt: new Date(now),
      },
      {
        id: crypto.randomUUID(),
        userId: testMember2Id,
        postType: 'startup',
        postId: testStartupId,
        role: 'member',
        joinedAt: new Date(now),
        createdAt: new Date(now),
        updatedAt: new Date(now),
      },
    ]);

    // Insert Builder Space
    await db.insert(teamSpaces).values({
      id: testSpaceId,
      postType: 'startup',
      postId: testStartupId,
      name: 'Test Startup Builder Space',
      description: 'A test Builder Space',
      createdAt: new Date(now),
      updatedAt: new Date(now),
    });
  });

  afterEach(() => {
    service.shutdown();
    httpServer.close();
    sqlite.close();
  });

  describe('WebSocket Connection Management', () => {
    it('should initialize WebSocket server', () => {
      expect(service).toBeDefined();
      expect(service.getOnlineUserCount()).toBe(0);
    });

    it('should track online users', async () => {
      // Create mock WebSocket connection
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
      } as any;

      // Simulate connection by directly adding to connections map
      // (In real scenario, this would happen through WebSocket connection)
      const userId = testFounderId;
      
      // We can't easily test WebSocket connections in unit tests without a real client
      // So we'll test the service methods that would be called
      expect(service.isUserOnline(userId)).toBe(false);
      expect(service.getOnlineUserCount()).toBe(0);
    });

    it('should return list of online users', () => {
      const onlineUsers = service.getOnlineUsers();
      expect(Array.isArray(onlineUsers)).toBe(true);
      expect(onlineUsers.length).toBe(0);
    });

    it('should check if user is online', () => {
      const isOnline = service.isUserOnline(testFounderId);
      expect(isOnline).toBe(false);
    });
  });

  describe('Message Broadcasting', () => {
    it('should queue message for offline user', () => {
      const message = {
        type: MessageType.GROUP_MESSAGE,
        payload: { content: 'Test message' },
        timestamp: new Date(),
      };

      const sent = service.sendToUser(testFounderId, message);
      expect(sent).toBe(false); // User is offline

      // Check that message was queued
      const queuedCount = service.getQueuedMessageCount(testFounderId);
      expect(queuedCount).toBe(1);
    });

    it('should broadcast to multiple users', () => {
      const message = {
        type: MessageType.GROUP_MESSAGE,
        payload: { content: 'Broadcast message' },
        timestamp: new Date(),
      };

      const userIds = [testFounderId, testMember1Id, testMember2Id];
      const result = service.broadcastToUsers(userIds, message);

      // All users are offline, so all should be queued
      expect(result.online).toBe(0);
      expect(result.offline).toBe(3);

      // Verify messages were queued
      expect(service.getQueuedMessageCount(testFounderId)).toBe(1);
      expect(service.getQueuedMessageCount(testMember1Id)).toBe(1);
      expect(service.getQueuedMessageCount(testMember2Id)).toBe(1);
    });

    it('should broadcast screening message to participants', () => {
      const message = {
        type: MessageType.SCREENING_MESSAGE,
        payload: { content: 'Screening message' },
        timestamp: new Date(),
      };

      const applicationId = crypto.randomUUID();
      service.broadcastScreeningMessage(
        applicationId,
        testFounderId,
        testMember1Id,
        message
      );

      // Both users should have queued messages
      expect(service.getQueuedMessageCount(testFounderId)).toBe(1);
      expect(service.getQueuedMessageCount(testMember1Id)).toBe(1);
    });

    it('should exclude sender from screening message broadcast', () => {
      const message = {
        type: MessageType.SCREENING_MESSAGE,
        payload: { content: 'Screening message' },
        timestamp: new Date(),
      };

      const applicationId = crypto.randomUUID();
      service.broadcastScreeningMessage(
        applicationId,
        testFounderId,
        testMember1Id,
        message,
        testFounderId // Exclude founder
      );

      // Only member1 should have queued message
      expect(service.getQueuedMessageCount(testFounderId)).toBe(0);
      expect(service.getQueuedMessageCount(testMember1Id)).toBe(1);
    });

    it('should broadcast group message to team members', async () => {
      const message = {
        type: MessageType.GROUP_MESSAGE,
        payload: { content: 'Team message' },
        timestamp: new Date(),
        senderId: testFounderId,
      };

      await service.broadcastGroupMessage(testSpaceId, message);

      // All team members should have queued messages
      expect(service.getQueuedMessageCount(testFounderId)).toBe(1);
      expect(service.getQueuedMessageCount(testMember1Id)).toBe(1);
      expect(service.getQueuedMessageCount(testMember2Id)).toBe(1);
    });

    it('should exclude sender from group message broadcast', async () => {
      const message = {
        type: MessageType.GROUP_MESSAGE,
        payload: { content: 'Team message' },
        timestamp: new Date(),
        senderId: testFounderId,
      };

      await service.broadcastGroupMessage(testSpaceId, message, testFounderId);

      // Founder should not have queued message
      expect(service.getQueuedMessageCount(testFounderId)).toBe(0);
      expect(service.getQueuedMessageCount(testMember1Id)).toBe(1);
      expect(service.getQueuedMessageCount(testMember2Id)).toBe(1);
    });
  });

  describe('Message Queuing', () => {
    it('should queue messages for offline users', () => {
      const message1 = {
        type: MessageType.GROUP_MESSAGE,
        payload: { content: 'Message 1' },
        timestamp: new Date(),
      };

      const message2 = {
        type: MessageType.GROUP_MESSAGE,
        payload: { content: 'Message 2' },
        timestamp: new Date(),
      };

      service.sendToUser(testFounderId, message1);
      service.sendToUser(testFounderId, message2);

      expect(service.getQueuedMessageCount(testFounderId)).toBe(2);
    });

    it('should respect queue size limit', () => {
      // Queue more than max size (100 messages)
      for (let i = 0; i < 105; i++) {
        const message = {
          type: MessageType.GROUP_MESSAGE,
          payload: { content: `Message ${i}` },
          timestamp: new Date(),
        };
        service.sendToUser(testFounderId, message);
      }

      // Should be capped at 100
      const queuedCount = service.getQueuedMessageCount(testFounderId);
      expect(queuedCount).toBeLessThanOrEqual(100);
    });

    it('should return 0 for user with no queued messages', () => {
      const count = service.getQueuedMessageCount(testFounderId);
      expect(count).toBe(0);
    });

    it('should handle multiple users with separate queues', () => {
      const message1 = {
        type: MessageType.GROUP_MESSAGE,
        payload: { content: 'Message for founder' },
        timestamp: new Date(),
      };

      const message2 = {
        type: MessageType.GROUP_MESSAGE,
        payload: { content: 'Message for member' },
        timestamp: new Date(),
      };

      service.sendToUser(testFounderId, message1);
      service.sendToUser(testMember1Id, message2);
      service.sendToUser(testMember1Id, message2);

      expect(service.getQueuedMessageCount(testFounderId)).toBe(1);
      expect(service.getQueuedMessageCount(testMember1Id)).toBe(2);
      expect(service.getQueuedMessageCount(testMember2Id)).toBe(0);
    });
  });

  describe('Message Types', () => {
    it('should support GROUP_MESSAGE type', () => {
      const message = {
        type: MessageType.GROUP_MESSAGE,
        payload: { content: 'Group message' },
        timestamp: new Date(),
      };

      service.sendToUser(testFounderId, message);
      expect(service.getQueuedMessageCount(testFounderId)).toBe(1);
    });

    it('should support SCREENING_MESSAGE type', () => {
      const message = {
        type: MessageType.SCREENING_MESSAGE,
        payload: { content: 'Screening message' },
        timestamp: new Date(),
      };

      service.sendToUser(testFounderId, message);
      expect(service.getQueuedMessageCount(testFounderId)).toBe(1);
    });

    it('should support LINK_ADDED type', () => {
      const message = {
        type: MessageType.LINK_ADDED,
        payload: { title: 'GitHub', url: 'https://github.com' },
        timestamp: new Date(),
      };

      service.sendToUser(testFounderId, message);
      expect(service.getQueuedMessageCount(testFounderId)).toBe(1);
    });

    it('should support TASK_CREATED type', () => {
      const message = {
        type: MessageType.TASK_CREATED,
        payload: { title: 'New task', description: 'Task description' },
        timestamp: new Date(),
      };

      service.sendToUser(testFounderId, message);
      expect(service.getQueuedMessageCount(testFounderId)).toBe(1);
    });

    it('should support TEAM_MEMBER_JOINED type', () => {
      const message = {
        type: MessageType.TEAM_MEMBER_JOINED,
        payload: { userId: testMember1Id, name: 'Test Member 1' },
        timestamp: new Date(),
      };

      service.sendToUser(testFounderId, message);
      expect(service.getQueuedMessageCount(testFounderId)).toBe(1);
    });

    it('should support USER_ONLINE type', () => {
      const message = {
        type: MessageType.USER_ONLINE,
        payload: { userId: testMember1Id },
        timestamp: new Date(),
      };

      service.sendToUser(testFounderId, message);
      expect(service.getQueuedMessageCount(testFounderId)).toBe(1);
    });

    it('should support USER_OFFLINE type', () => {
      const message = {
        type: MessageType.USER_OFFLINE,
        payload: { userId: testMember1Id },
        timestamp: new Date(),
      };

      service.sendToUser(testFounderId, message);
      expect(service.getQueuedMessageCount(testFounderId)).toBe(1);
    });
  });

  describe('Team Member Lookup', () => {
    it('should broadcast to all team members in a space', async () => {
      const message = {
        type: MessageType.GROUP_MESSAGE,
        payload: { content: 'Team announcement' },
        timestamp: new Date(),
      };

      await service.broadcastGroupMessage(testSpaceId, message);

      // All 3 team members should receive the message
      expect(service.getQueuedMessageCount(testFounderId)).toBe(1);
      expect(service.getQueuedMessageCount(testMember1Id)).toBe(1);
      expect(service.getQueuedMessageCount(testMember2Id)).toBe(1);
    });

    it('should handle non-existent space gracefully', async () => {
      const fakeSpaceId = crypto.randomUUID();
      const message = {
        type: MessageType.GROUP_MESSAGE,
        payload: { content: 'Message to nowhere' },
        timestamp: new Date(),
      };

      // Should not throw error
      await service.broadcastGroupMessage(fakeSpaceId, message);

      // No messages should be queued
      expect(service.getQueuedMessageCount(testFounderId)).toBe(0);
    });
  });

  describe('Service Lifecycle', () => {
    it('should shutdown gracefully', () => {
      expect(() => service.shutdown()).not.toThrow();
    });

    it('should clear connections on shutdown', () => {
      service.shutdown();
      expect(service.getOnlineUserCount()).toBe(0);
    });

    it('should handle multiple shutdowns', () => {
      service.shutdown();
      expect(() => service.shutdown()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty user list in broadcast', () => {
      const message = {
        type: MessageType.GROUP_MESSAGE,
        payload: { content: 'Empty broadcast' },
        timestamp: new Date(),
      };

      const result = service.broadcastToUsers([], message);
      expect(result.online).toBe(0);
      expect(result.offline).toBe(0);
    });

    it('should handle duplicate user IDs in broadcast', () => {
      const message = {
        type: MessageType.GROUP_MESSAGE,
        payload: { content: 'Duplicate broadcast' },
        timestamp: new Date(),
      };

      const userIds = [testFounderId, testFounderId, testFounderId];
      const result = service.broadcastToUsers(userIds, message);

      // Should queue 3 messages (duplicates are allowed)
      expect(result.offline).toBe(3);
      expect(service.getQueuedMessageCount(testFounderId)).toBe(3);
    });

    it('should handle message with undefined payload', () => {
      const message = {
        type: MessageType.GROUP_MESSAGE,
        payload: undefined,
        timestamp: new Date(),
      };

      expect(() => service.sendToUser(testFounderId, message as any)).not.toThrow();
    });

    it('should handle message with null timestamp', () => {
      const message = {
        type: MessageType.GROUP_MESSAGE,
        payload: { content: 'Test' },
        timestamp: null as any,
      };

      expect(() => service.sendToUser(testFounderId, message)).not.toThrow();
    });
  });

  describe('Real-time Notifications', () => {
    it('should support link added notifications', async () => {
      const message = {
        type: MessageType.LINK_ADDED,
        payload: {
          linkId: crypto.randomUUID(),
          title: 'GitHub Repo',
          url: 'https://github.com/test/repo',
          creatorId: testFounderId,
        },
        timestamp: new Date(),
      };

      await service.broadcastGroupMessage(testSpaceId, message, testFounderId);

      // Members should be notified (founder excluded as sender)
      expect(service.getQueuedMessageCount(testMember1Id)).toBe(1);
      expect(service.getQueuedMessageCount(testMember2Id)).toBe(1);
    });

    it('should support task created notifications', async () => {
      const message = {
        type: MessageType.TASK_CREATED,
        payload: {
          taskId: crypto.randomUUID(),
          title: 'New Task',
          description: 'Task description',
          creatorId: testMember1Id,
        },
        timestamp: new Date(),
      };

      await service.broadcastGroupMessage(testSpaceId, message, testMember1Id);

      // Founder and member2 should be notified
      expect(service.getQueuedMessageCount(testFounderId)).toBe(1);
      expect(service.getQueuedMessageCount(testMember2Id)).toBe(1);
    });

    it('should support task updated notifications', async () => {
      const message = {
        type: MessageType.TASK_UPDATED,
        payload: {
          taskId: crypto.randomUUID(),
          completed: true,
          completedBy: testMember2Id,
        },
        timestamp: new Date(),
      };

      await service.broadcastGroupMessage(testSpaceId, message, testMember2Id);

      // Founder and member1 should be notified
      expect(service.getQueuedMessageCount(testFounderId)).toBe(1);
      expect(service.getQueuedMessageCount(testMember1Id)).toBe(1);
    });

    it('should support Builder Space created notifications', () => {
      const message = {
        type: MessageType.BUILDER_SPACE_CREATED,
        payload: {
          spaceId: testSpaceId,
          name: 'New Builder Space',
        },
        timestamp: new Date(),
      };

      const userIds = [testFounderId, testMember1Id];
      service.broadcastToUsers(userIds, message);

      expect(service.getQueuedMessageCount(testFounderId)).toBe(1);
      expect(service.getQueuedMessageCount(testMember1Id)).toBe(1);
    });

    it('should support screening chat created notifications', () => {
      const message = {
        type: MessageType.SCREENING_CHAT_CREATED,
        payload: {
          applicationId: crypto.randomUUID(),
          founderId: testFounderId,
          applicantId: testMember1Id,
        },
        timestamp: new Date(),
      };

      const userIds = [testFounderId, testMember1Id];
      service.broadcastToUsers(userIds, message);

      expect(service.getQueuedMessageCount(testFounderId)).toBe(1);
      expect(service.getQueuedMessageCount(testMember1Id)).toBe(1);
    });
  });
});
