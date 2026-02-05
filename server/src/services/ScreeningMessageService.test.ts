import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScreeningMessageService } from './ScreeningMessageService.js';
import { ScreeningChatService } from './ScreeningChatService.js';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { users, startups, applications, screeningMessages } from '../db/schema.js';
import { eq } from 'drizzle-orm';

describe('ScreeningMessageService', () => {
  let db: BetterSQLite3Database<any>;
  let sqlite: Database.Database;
  let service: ScreeningMessageService;
  let chatService: ScreeningChatService;
  let testFounderId: string;
  let testApplicantId: string;
  let testStartupId: string;
  let testApplicationId: string;

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

      CREATE TABLE applications (
        id TEXT PRIMARY KEY,
        applicant_id TEXT NOT NULL,
        post_type TEXT NOT NULL,
        post_id TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (applicant_id) REFERENCES users(id)
      );

      CREATE TABLE screening_messages (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (application_id) REFERENCES applications(id),
        FOREIGN KEY (sender_id) REFERENCES users(id)
      );
    `);

    // Initialize services
    service = new ScreeningMessageService(db);
    chatService = new ScreeningChatService(db);

    // Create test data
    const now = Date.now();
    testFounderId = crypto.randomUUID();
    testApplicantId = crypto.randomUUID();
    testStartupId = crypto.randomUUID();
    testApplicationId = crypto.randomUUID();

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
        id: testApplicantId,
        email: 'applicant@test.com',
        name: 'Test Applicant',
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

    // Insert accepted application
    await db.insert(applications).values({
      id: testApplicationId,
      applicantId: testApplicantId,
      postType: 'startup',
      postId: testStartupId,
      message: 'I want to join',
      status: 'accepted',
      createdAt: new Date(now),
      updatedAt: new Date(now),
    });
  });

  afterEach(() => {
    sqlite.close();
  });

  describe('sendScreeningMessage', () => {
    it('should send a message from founder to applicant', async () => {
      const message = await service.sendScreeningMessage({
        applicationId: testApplicationId,
        senderId: testFounderId,
        content: 'Hello, thanks for applying!',
      });

      expect(message).toBeDefined();
      expect(message.applicationId).toBe(testApplicationId);
      expect(message.senderId).toBe(testFounderId);
      expect(message.senderName).toBe('Test Founder');
      expect(message.content).toBe('Hello, thanks for applying!');
      expect(message.id).toBeDefined();
      expect(message.createdAt).toBeInstanceOf(Date);
    });

    it('should send a message from applicant to founder', async () => {
      const message = await service.sendScreeningMessage({
        applicationId: testApplicationId,
        senderId: testApplicantId,
        content: 'Thank you for accepting my application!',
      });

      expect(message).toBeDefined();
      expect(message.senderId).toBe(testApplicantId);
      expect(message.senderName).toBe('Test Applicant');
      expect(message.content).toBe('Thank you for accepting my application!');
    });

    it('should reject message from unauthorized user', async () => {
      const unauthorizedUserId = crypto.randomUUID();

      await expect(
        service.sendScreeningMessage({
          applicationId: testApplicationId,
          senderId: unauthorizedUserId,
          content: 'Unauthorized message',
        })
      ).rejects.toThrow('Access denied');
    });

    it('should reject empty message content', async () => {
      await expect(
        service.sendScreeningMessage({
          applicationId: testApplicationId,
          senderId: testFounderId,
          content: '',
        })
      ).rejects.toThrow('Message content cannot be empty');
    });

    it('should reject whitespace-only message content', async () => {
      await expect(
        service.sendScreeningMessage({
          applicationId: testApplicationId,
          senderId: testFounderId,
          content: '   \n\t  ',
        })
      ).rejects.toThrow('Message content cannot be empty');
    });

    it('should sanitize HTML content', async () => {
      const message = await service.sendScreeningMessage({
        applicationId: testApplicationId,
        senderId: testFounderId,
        content: '<script>alert("xss")</script>Hello',
      });

      expect(message.content).not.toContain('<script>');
      expect(message.content).toContain('Hello');
    });

    it('should reject message exceeding max length', async () => {
      const longContent = 'a'.repeat(5001);

      await expect(
        service.sendScreeningMessage({
          applicationId: testApplicationId,
          senderId: testFounderId,
          content: longContent,
        })
      ).rejects.toThrow('cannot exceed 5000 characters');
    });

    it('should accept message at max length', async () => {
      const maxContent = 'a'.repeat(5000);

      const message = await service.sendScreeningMessage({
        applicationId: testApplicationId,
        senderId: testFounderId,
        content: maxContent,
      });

      expect(message.content).toBe(maxContent);
    });
  });

  describe('getScreeningMessages', () => {
    beforeEach(async () => {
      // Add some test messages
      const now = Date.now();
      await db.insert(screeningMessages).values([
        {
          id: crypto.randomUUID(),
          applicationId: testApplicationId,
          senderId: testFounderId,
          content: 'First message',
          createdAt: new Date(now),
          updatedAt: new Date(now),
        },
        {
          id: crypto.randomUUID(),
          applicationId: testApplicationId,
          senderId: testApplicantId,
          content: 'Second message',
          createdAt: new Date(now + 1000),
          updatedAt: new Date(now + 1000),
        },
        {
          id: crypto.randomUUID(),
          applicationId: testApplicationId,
          senderId: testFounderId,
          content: 'Third message',
          createdAt: new Date(now + 2000),
          updatedAt: new Date(now + 2000),
        },
      ]);
    });

    it('should retrieve all messages for founder', async () => {
      const messages = await service.getScreeningMessages(testApplicationId, testFounderId);

      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('Second message');
      expect(messages[2].content).toBe('Third message');
    });

    it('should retrieve all messages for applicant', async () => {
      const messages = await service.getScreeningMessages(testApplicationId, testApplicantId);

      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('Second message');
      expect(messages[2].content).toBe('Third message');
    });

    it('should return messages in chronological order', async () => {
      const messages = await service.getScreeningMessages(testApplicationId, testFounderId);

      // Verify timestamps are in ascending order
      for (let i = 1; i < messages.length; i++) {
        expect(messages[i].createdAt.getTime()).toBeGreaterThanOrEqual(
          messages[i - 1].createdAt.getTime()
        );
      }
    });

    it('should reject unauthorized user', async () => {
      const unauthorizedUserId = crypto.randomUUID();

      await expect(
        service.getScreeningMessages(testApplicationId, unauthorizedUserId)
      ).rejects.toThrow('Access denied');
    });

    it('should return empty array for chat with no messages', async () => {
      // Create new application with no messages
      const newApplicationId = crypto.randomUUID();
      await db.insert(applications).values({
        id: newApplicationId,
        applicantId: testApplicantId,
        postType: 'startup',
        postId: testStartupId,
        message: 'Another application',
        status: 'accepted',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const messages = await service.getScreeningMessages(newApplicationId, testFounderId);
      expect(messages).toHaveLength(0);
    });

    it('should include sender information', async () => {
      const messages = await service.getScreeningMessages(testApplicationId, testFounderId);

      expect(messages[0].senderName).toBe('Test Founder');
      expect(messages[1].senderName).toBe('Test Applicant');
      expect(messages[2].senderName).toBe('Test Founder');
    });
  });

  describe('getLatestMessage', () => {
    it('should return the most recent message', async () => {
      const now = Date.now();
      await db.insert(screeningMessages).values([
        {
          id: crypto.randomUUID(),
          applicationId: testApplicationId,
          senderId: testFounderId,
          content: 'First message',
          createdAt: new Date(now),
          updatedAt: new Date(now),
        },
        {
          id: crypto.randomUUID(),
          applicationId: testApplicationId,
          senderId: testApplicantId,
          content: 'Latest message',
          createdAt: new Date(now + 2000),
          updatedAt: new Date(now + 2000),
        },
        {
          id: crypto.randomUUID(),
          applicationId: testApplicationId,
          senderId: testFounderId,
          content: 'Middle message',
          createdAt: new Date(now + 1000),
          updatedAt: new Date(now + 1000),
        },
      ]);

      const latest = await service.getLatestMessage(testApplicationId, testFounderId);

      expect(latest).toBeDefined();
      expect(latest!.content).toBe('Latest message');
      expect(latest!.senderId).toBe(testApplicantId);
    });

    it('should return null for chat with no messages', async () => {
      const latest = await service.getLatestMessage(testApplicationId, testFounderId);
      expect(latest).toBeNull();
    });

    it('should reject unauthorized user', async () => {
      const unauthorizedUserId = crypto.randomUUID();

      await expect(
        service.getLatestMessage(testApplicationId, unauthorizedUserId)
      ).rejects.toThrow('Access denied');
    });
  });

  describe('getMessageCount', () => {
    it('should return correct message count', async () => {
      const now = Date.now();
      await db.insert(screeningMessages).values([
        {
          id: crypto.randomUUID(),
          applicationId: testApplicationId,
          senderId: testFounderId,
          content: 'Message 1',
          createdAt: new Date(now),
          updatedAt: new Date(now),
        },
        {
          id: crypto.randomUUID(),
          applicationId: testApplicationId,
          senderId: testApplicantId,
          content: 'Message 2',
          createdAt: new Date(now + 1000),
          updatedAt: new Date(now + 1000),
        },
      ]);

      const count = await service.getMessageCount(testApplicationId, testFounderId);
      expect(count).toBe(2);
    });

    it('should return 0 for chat with no messages', async () => {
      const count = await service.getMessageCount(testApplicationId, testFounderId);
      expect(count).toBe(0);
    });

    it('should reject unauthorized user', async () => {
      const unauthorizedUserId = crypto.randomUUID();

      await expect(
        service.getMessageCount(testApplicationId, unauthorizedUserId)
      ).rejects.toThrow('Access denied');
    });
  });
});
