import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import screeningChatRoutes from './screeningChats.js';
import { screeningChatService } from '../services/ScreeningChatService.js';
import { screeningMessageService } from '../services/ScreeningMessageService.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateScreeningChatAccess } from '../middleware/screeningChatAuth.js';

// Mock the services
vi.mock('../services/ScreeningChatService.js', () => ({
  screeningChatService: {
    getUserScreeningChats: vi.fn(),
    createScreeningChat: vi.fn(),
    getScreeningChat: vi.fn(),
    validateScreeningChatAccess: vi.fn(),
  },
}));

vi.mock('../services/ScreeningMessageService.js', () => ({
  screeningMessageService: {
    sendScreeningMessage: vi.fn(),
    getScreeningMessages: vi.fn(),
  },
}));

// Mock the middleware
vi.mock('../middleware/auth.js', () => ({
  authenticateToken: vi.fn((req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }),
  AuthRequest: class {},
}));

vi.mock('../middleware/screeningChatAuth.js', () => ({
  validateScreeningChatAccess: vi.fn((req, res, next) => {
    req.screeningChatParticipants = {
      founderId: 'founder-id',
      applicantId: 'applicant-id',
    };
    next();
  }),
}));

describe('Screening Chat Routes', () => {
  let app: Express;

  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express();
    app.use(express.json());
    app.use('/api/screening-chats', screeningChatRoutes);

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('GET /api/screening-chats', () => {
    it('should return all screening chats for authenticated user', async () => {
      const testDate = new Date('2024-01-01T00:00:00.000Z');
      const mockChats = [
        {
          id: 'app-1',
          applicationId: 'app-1',
          founderId: 'founder-1',
          applicantId: 'test-user-id',
          postType: 'startup',
          postId: 'startup-1',
          postName: 'Test Startup',
          status: 'accepted',
          createdAt: testDate,
        },
      ];

      vi.mocked(screeningChatService.getUserScreeningChats).mockResolvedValue(mockChats);

      const response = await request(app)
        .get('/api/screening-chats')
        .expect(200);

      expect(response.body).toEqual({ 
        screeningChats: [
          {
            ...mockChats[0],
            createdAt: testDate.toISOString(),
          }
        ]
      });
      expect(screeningChatService.getUserScreeningChats).toHaveBeenCalledWith('test-user-id');
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(screeningChatService.getUserScreeningChats).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/screening-chats')
        .expect(500);

      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('POST /api/screening-chats', () => {
    it('should create a new screening chat', async () => {
      const testDate = new Date('2024-01-01T00:00:00.000Z');
      const mockChat = {
        id: 'app-1',
        applicationId: 'app-1',
        founderId: 'founder-1',
        applicantId: 'applicant-1',
        postType: 'startup',
        postId: 'startup-1',
        postName: 'Test Startup',
        status: 'accepted',
        createdAt: testDate,
      };

      vi.mocked(screeningChatService.createScreeningChat).mockResolvedValue(mockChat);

      const response = await request(app)
        .post('/api/screening-chats')
        .send({ applicationId: 'app-1' })
        .expect(201);

      expect(response.body).toEqual({ 
        screeningChat: {
          ...mockChat,
          createdAt: testDate.toISOString(),
        }
      });
      expect(screeningChatService.createScreeningChat).toHaveBeenCalledWith(
        'app-1',
        'test-user-id'
      );
    });

    it('should return 400 if applicationId is missing', async () => {
      const response = await request(app)
        .post('/api/screening-chats')
        .send({})
        .expect(400);

      expect(response.body).toEqual({ error: 'Application ID is required' });
      expect(screeningChatService.createScreeningChat).not.toHaveBeenCalled();
    });

    it('should return 404 if application not found', async () => {
      vi.mocked(screeningChatService.createScreeningChat).mockRejectedValue(
        new Error('Application not found')
      );

      const response = await request(app)
        .post('/api/screening-chats')
        .send({ applicationId: 'invalid-id' })
        .expect(404);

      expect(response.body).toEqual({ error: 'Application not found' });
    });

    it('should return 403 if user is not authorized', async () => {
      vi.mocked(screeningChatService.createScreeningChat).mockRejectedValue(
        new Error('Access denied: Only the founder can create screening chats')
      );

      const response = await request(app)
        .post('/api/screening-chats')
        .send({ applicationId: 'app-1' })
        .expect(403);

      expect(response.body).toEqual({
        error: 'Access denied: Only the founder can create screening chats',
      });
    });

    it('should return 409 if screening chat already exists', async () => {
      vi.mocked(screeningChatService.createScreeningChat).mockRejectedValue(
        new Error('Screening chat already exists')
      );

      const response = await request(app)
        .post('/api/screening-chats')
        .send({ applicationId: 'app-1' })
        .expect(409);

      expect(response.body).toEqual({ error: 'Screening chat already exists' });
    });
  });

  describe('GET /api/screening-chats/:id', () => {
    it('should return a specific screening chat', async () => {
      const testDate = new Date('2024-01-01T00:00:00.000Z');
      const mockChat = {
        id: 'app-1',
        applicationId: 'app-1',
        founderId: 'founder-1',
        applicantId: 'test-user-id',
        postType: 'startup',
        postId: 'startup-1',
        postName: 'Test Startup',
        status: 'accepted',
        createdAt: testDate,
      };

      vi.mocked(screeningChatService.getScreeningChat).mockResolvedValue(mockChat);

      const response = await request(app)
        .get('/api/screening-chats/app-1')
        .expect(200);

      expect(response.body).toEqual({ 
        screeningChat: {
          ...mockChat,
          createdAt: testDate.toISOString(),
        }
      });
      expect(screeningChatService.getScreeningChat).toHaveBeenCalledWith('app-1', 'test-user-id');
    });

    it('should return 404 if screening chat not found', async () => {
      vi.mocked(screeningChatService.getScreeningChat).mockRejectedValue(
        new Error('Screening chat not found')
      );

      const response = await request(app)
        .get('/api/screening-chats/invalid-id')
        .expect(404);

      expect(response.body).toEqual({ error: 'Screening chat not found' });
    });

    it('should return 403 if user is not authorized', async () => {
      vi.mocked(screeningChatService.getScreeningChat).mockRejectedValue(
        new Error('Access denied')
      );

      const response = await request(app)
        .get('/api/screening-chats/app-1')
        .expect(403);

      expect(response.body).toEqual({ error: 'Access denied' });
    });
  });

  describe('POST /api/screening-chats/:id/messages', () => {
    it('should send a message in a screening chat', async () => {
      const testDate = new Date('2024-01-01T00:00:00.000Z');
      const mockMessage = {
        id: 'msg-1',
        applicationId: 'app-1',
        senderId: 'test-user-id',
        senderName: 'Test User',
        content: 'Hello, this is a test message',
        createdAt: testDate,
        updatedAt: testDate,
      };

      vi.mocked(screeningMessageService.sendScreeningMessage).mockResolvedValue(mockMessage);

      const response = await request(app)
        .post('/api/screening-chats/app-1/messages')
        .send({ content: 'Hello, this is a test message' })
        .expect(201);

      expect(response.body).toEqual({ 
        message: {
          ...mockMessage,
          createdAt: testDate.toISOString(),
          updatedAt: testDate.toISOString(),
        }
      });
      expect(screeningMessageService.sendScreeningMessage).toHaveBeenCalledWith({
        applicationId: 'app-1',
        senderId: 'test-user-id',
        content: 'Hello, this is a test message',
      });
    });

    it('should return 400 if content is missing', async () => {
      const response = await request(app)
        .post('/api/screening-chats/app-1/messages')
        .send({})
        .expect(400);

      expect(response.body).toEqual({ error: 'Message content is required' });
      expect(screeningMessageService.sendScreeningMessage).not.toHaveBeenCalled();
    });

    it('should return 403 if user is not authorized', async () => {
      vi.mocked(screeningMessageService.sendScreeningMessage).mockRejectedValue(
        new Error('Access denied: You are not authorized to send messages in this screening chat')
      );

      const response = await request(app)
        .post('/api/screening-chats/app-1/messages')
        .send({ content: 'Test message' })
        .expect(403);

      expect(response.body).toEqual({
        error: 'Access denied: You are not authorized to send messages in this screening chat',
      });
    });

    it('should return 400 if content is empty after sanitization', async () => {
      vi.mocked(screeningMessageService.sendScreeningMessage).mockRejectedValue(
        new Error('Message content cannot be empty')
      );

      const response = await request(app)
        .post('/api/screening-chats/app-1/messages')
        .send({ content: '   ' })
        .expect(400);

      expect(response.body).toEqual({ error: 'Message content cannot be empty' });
    });

    it('should return 400 if content exceeds maximum length', async () => {
      vi.mocked(screeningMessageService.sendScreeningMessage).mockRejectedValue(
        new Error('Message content cannot exceed 5000 characters')
      );

      const response = await request(app)
        .post('/api/screening-chats/app-1/messages')
        .send({ content: 'a'.repeat(5001) })
        .expect(400);

      expect(response.body).toEqual({ error: 'Message content cannot exceed 5000 characters' });
    });
  });

  describe('GET /api/screening-chats/:id/messages', () => {
    it('should return message history for a screening chat', async () => {
      const date1 = new Date('2024-01-01T00:00:00.000Z');
      const date2 = new Date('2024-01-02T00:00:00.000Z');
      const mockMessages = [
        {
          id: 'msg-1',
          applicationId: 'app-1',
          senderId: 'founder-1',
          senderName: 'Founder',
          content: 'Hello!',
          createdAt: date1,
          updatedAt: date1,
        },
        {
          id: 'msg-2',
          applicationId: 'app-1',
          senderId: 'test-user-id',
          senderName: 'Test User',
          content: 'Hi there!',
          createdAt: date2,
          updatedAt: date2,
        },
      ];

      vi.mocked(screeningMessageService.getScreeningMessages).mockResolvedValue(mockMessages);

      const response = await request(app)
        .get('/api/screening-chats/app-1/messages')
        .expect(200);

      expect(response.body).toEqual({ 
        messages: [
          {
            ...mockMessages[0],
            createdAt: date1.toISOString(),
            updatedAt: date1.toISOString(),
          },
          {
            ...mockMessages[1],
            createdAt: date2.toISOString(),
            updatedAt: date2.toISOString(),
          }
        ]
      });
      expect(screeningMessageService.getScreeningMessages).toHaveBeenCalledWith(
        'app-1',
        'test-user-id'
      );
    });

    it('should return empty array if no messages exist', async () => {
      vi.mocked(screeningMessageService.getScreeningMessages).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/screening-chats/app-1/messages')
        .expect(200);

      expect(response.body).toEqual({ messages: [] });
    });

    it('should return 403 if user is not authorized', async () => {
      vi.mocked(screeningMessageService.getScreeningMessages).mockRejectedValue(
        new Error('Access denied: You are not authorized to view messages in this screening chat')
      );

      const response = await request(app)
        .get('/api/screening-chats/app-1/messages')
        .expect(403);

      expect(response.body).toEqual({
        error: 'Access denied: You are not authorized to view messages in this screening chat',
      });
    });
  });
});
