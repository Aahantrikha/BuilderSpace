import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GroupChatService } from './GroupChatService.js';
import { BuilderSpaceService } from './BuilderSpaceService.js';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { users, startups, teamMembers, teamSpaces, spaceMessages } from '../db/schema.js';

describe('GroupChatService', () => {
  let db: BetterSQLite3Database<any>;
  let sqlite: Database.Database;
  let service: GroupChatService;
  let builderSpaceService: BuilderSpaceService;
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

      CREATE TABLE space_messages (
        id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (space_id) REFERENCES team_spaces(id),
        FOREIGN KEY (sender_id) REFERENCES users(id)
      );
    `);

    // Initialize services
    service = new GroupChatService(db);
    builderSpaceService = new BuilderSpaceService(db);

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
    sqlite.close();
  });

  describe('sendGroupMessage', () => {
    it('should send a message from founder to team', async () => {
      const message = await service.sendGroupMessage({
        spaceId: testSpaceId,
        senderId: testFounderId,
        content: 'Hello team!',
      });

      expect(message).toBeDefined();
      expect(message.spaceId).toBe(testSpaceId);
      expect(message.senderId).toBe(testFounderId);
      expect(message.senderName).toBe('Test Founder');
      expect(message.content).toBe('Hello team!');
      expect(message.id).toBeDefined();
      expect(message.createdAt).toBeInstanceOf(Date);
    });

    it('should send a message from team member to team', async () => {
      const message = await service.sendGroupMessage({
        spaceId: testSpaceId,
        senderId: testMember1Id,
        content: 'Hi everyone!',
      });

      expect(message).toBeDefined();
      expect(message.senderId).toBe(testMember1Id);
      expect(message.senderName).toBe('Test Member 1');
      expect(message.content).toBe('Hi everyone!');
    });

    it('should reject message from non-team member', async () => {
      const nonMemberId = crypto.randomUUID();

      // Insert non-member user
      await db.insert(users).values({
        id: nonMemberId,
        email: 'nonmember@test.com',
        name: 'Non Member',
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.sendGroupMessage({
          spaceId: testSpaceId,
          senderId: nonMemberId,
          content: 'Unauthorized message',
        })
      ).rejects.toThrow('Access denied');
    });

    it('should reject message to non-existent space', async () => {
      const fakeSpaceId = crypto.randomUUID();

      await expect(
        service.sendGroupMessage({
          spaceId: fakeSpaceId,
          senderId: testFounderId,
          content: 'Message to nowhere',
        })
      ).rejects.toThrow('Builder Space not found');
    });

    it('should reject empty message content', async () => {
      await expect(
        service.sendGroupMessage({
          spaceId: testSpaceId,
          senderId: testFounderId,
          content: '',
        })
      ).rejects.toThrow('Message content cannot be empty');
    });

    it('should reject whitespace-only message content', async () => {
      await expect(
        service.sendGroupMessage({
          spaceId: testSpaceId,
          senderId: testFounderId,
          content: '   \n\t  ',
        })
      ).rejects.toThrow('Message content cannot be empty');
    });

    it('should sanitize HTML content', async () => {
      const message = await service.sendGroupMessage({
        spaceId: testSpaceId,
        senderId: testFounderId,
        content: '<script>alert("xss")</script>Hello team',
      });

      expect(message.content).not.toContain('<script>');
      expect(message.content).toContain('Hello team');
    });

    it('should reject message exceeding max length', async () => {
      const longContent = 'a'.repeat(5001);

      await expect(
        service.sendGroupMessage({
          spaceId: testSpaceId,
          senderId: testFounderId,
          content: longContent,
        })
      ).rejects.toThrow('cannot exceed 5000 characters');
    });

    it('should accept message at max length', async () => {
      const maxContent = 'a'.repeat(5000);

      const message = await service.sendGroupMessage({
        spaceId: testSpaceId,
        senderId: testFounderId,
        content: maxContent,
      });

      expect(message.content).toBe(maxContent);
    });
  });

  describe('getGroupMessages', () => {
    beforeEach(async () => {
      // Add some test messages
      const now = Date.now();
      await db.insert(spaceMessages).values([
        {
          id: crypto.randomUUID(),
          spaceId: testSpaceId,
          senderId: testFounderId,
          content: 'First message',
          createdAt: new Date(now),
          updatedAt: new Date(now),
        },
        {
          id: crypto.randomUUID(),
          spaceId: testSpaceId,
          senderId: testMember1Id,
          content: 'Second message',
          createdAt: new Date(now + 1000),
          updatedAt: new Date(now + 1000),
        },
        {
          id: crypto.randomUUID(),
          spaceId: testSpaceId,
          senderId: testMember2Id,
          content: 'Third message',
          createdAt: new Date(now + 2000),
          updatedAt: new Date(now + 2000),
        },
      ]);
    });

    it('should retrieve all messages for founder', async () => {
      const messages = await service.getGroupMessages(testSpaceId, testFounderId);

      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('Second message');
      expect(messages[2].content).toBe('Third message');
    });

    it('should retrieve all messages for team member', async () => {
      const messages = await service.getGroupMessages(testSpaceId, testMember1Id);

      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('Second message');
      expect(messages[2].content).toBe('Third message');
    });

    it('should return messages in chronological order', async () => {
      const messages = await service.getGroupMessages(testSpaceId, testFounderId);

      // Verify timestamps are in ascending order
      for (let i = 1; i < messages.length; i++) {
        expect(messages[i].createdAt.getTime()).toBeGreaterThanOrEqual(
          messages[i - 1].createdAt.getTime()
        );
      }
    });

    it('should reject non-team member', async () => {
      const nonMemberId = crypto.randomUUID();

      // Insert non-member user
      await db.insert(users).values({
        id: nonMemberId,
        email: 'nonmember@test.com',
        name: 'Non Member',
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.getGroupMessages(testSpaceId, nonMemberId)
      ).rejects.toThrow('Access denied');
    });

    it('should return empty array for space with no messages', async () => {
      // Create new space with no messages
      const newSpaceId = crypto.randomUUID();
      await db.insert(teamSpaces).values({
        id: newSpaceId,
        postType: 'startup',
        postId: testStartupId,
        name: 'Empty Space',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const messages = await service.getGroupMessages(newSpaceId, testFounderId);
      expect(messages).toHaveLength(0);
    });

    it('should include sender information', async () => {
      const messages = await service.getGroupMessages(testSpaceId, testFounderId);

      expect(messages[0].senderName).toBe('Test Founder');
      expect(messages[1].senderName).toBe('Test Member 1');
      expect(messages[2].senderName).toBe('Test Member 2');
    });

    it('should reject access to non-existent space', async () => {
      const fakeSpaceId = crypto.randomUUID();

      await expect(
        service.getGroupMessages(fakeSpaceId, testFounderId)
      ).rejects.toThrow('Builder Space not found');
    });
  });

  describe('getLatestMessage', () => {
    it('should return the most recent message', async () => {
      const now = Date.now();
      await db.insert(spaceMessages).values([
        {
          id: crypto.randomUUID(),
          spaceId: testSpaceId,
          senderId: testFounderId,
          content: 'First message',
          createdAt: new Date(now),
          updatedAt: new Date(now),
        },
        {
          id: crypto.randomUUID(),
          spaceId: testSpaceId,
          senderId: testMember2Id,
          content: 'Latest message',
          createdAt: new Date(now + 2000),
          updatedAt: new Date(now + 2000),
        },
        {
          id: crypto.randomUUID(),
          spaceId: testSpaceId,
          senderId: testMember1Id,
          content: 'Middle message',
          createdAt: new Date(now + 1000),
          updatedAt: new Date(now + 1000),
        },
      ]);

      const latest = await service.getLatestMessage(testSpaceId, testFounderId);

      expect(latest).toBeDefined();
      expect(latest!.content).toBe('Latest message');
      expect(latest!.senderId).toBe(testMember2Id);
      expect(latest!.senderName).toBe('Test Member 2');
    });

    it('should return null for space with no messages', async () => {
      const latest = await service.getLatestMessage(testSpaceId, testFounderId);
      expect(latest).toBeNull();
    });

    it('should reject non-team member', async () => {
      const nonMemberId = crypto.randomUUID();

      // Insert non-member user
      await db.insert(users).values({
        id: nonMemberId,
        email: 'nonmember@test.com',
        name: 'Non Member',
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.getLatestMessage(testSpaceId, nonMemberId)
      ).rejects.toThrow('Access denied');
    });
  });

  describe('getMessageCount', () => {
    it('should return correct message count', async () => {
      const now = Date.now();
      await db.insert(spaceMessages).values([
        {
          id: crypto.randomUUID(),
          spaceId: testSpaceId,
          senderId: testFounderId,
          content: 'Message 1',
          createdAt: new Date(now),
          updatedAt: new Date(now),
        },
        {
          id: crypto.randomUUID(),
          spaceId: testSpaceId,
          senderId: testMember1Id,
          content: 'Message 2',
          createdAt: new Date(now + 1000),
          updatedAt: new Date(now + 1000),
        },
        {
          id: crypto.randomUUID(),
          spaceId: testSpaceId,
          senderId: testMember2Id,
          content: 'Message 3',
          createdAt: new Date(now + 2000),
          updatedAt: new Date(now + 2000),
        },
      ]);

      const count = await service.getMessageCount(testSpaceId, testFounderId);
      expect(count).toBe(3);
    });

    it('should return 0 for space with no messages', async () => {
      const count = await service.getMessageCount(testSpaceId, testFounderId);
      expect(count).toBe(0);
    });

    it('should reject non-team member', async () => {
      const nonMemberId = crypto.randomUUID();

      // Insert non-member user
      await db.insert(users).values({
        id: nonMemberId,
        email: 'nonmember@test.com',
        name: 'Non Member',
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.getMessageCount(testSpaceId, nonMemberId)
      ).rejects.toThrow('Access denied');
    });
  });

  describe('Team member validation', () => {
    it('should allow all team members to send messages', async () => {
      const founderMessage = await service.sendGroupMessage({
        spaceId: testSpaceId,
        senderId: testFounderId,
        content: 'Founder message',
      });

      const member1Message = await service.sendGroupMessage({
        spaceId: testSpaceId,
        senderId: testMember1Id,
        content: 'Member 1 message',
      });

      const member2Message = await service.sendGroupMessage({
        spaceId: testSpaceId,
        senderId: testMember2Id,
        content: 'Member 2 message',
      });

      expect(founderMessage).toBeDefined();
      expect(member1Message).toBeDefined();
      expect(member2Message).toBeDefined();
    });

    it('should allow all team members to read messages', async () => {
      // Add a message
      await db.insert(spaceMessages).values({
        id: crypto.randomUUID(),
        spaceId: testSpaceId,
        senderId: testFounderId,
        content: 'Test message',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const founderMessages = await service.getGroupMessages(testSpaceId, testFounderId);
      const member1Messages = await service.getGroupMessages(testSpaceId, testMember1Id);
      const member2Messages = await service.getGroupMessages(testSpaceId, testMember2Id);

      expect(founderMessages).toHaveLength(1);
      expect(member1Messages).toHaveLength(1);
      expect(member2Messages).toHaveLength(1);
    });
  });
});
