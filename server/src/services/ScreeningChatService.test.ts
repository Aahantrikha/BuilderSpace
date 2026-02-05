import { describe, it, expect, beforeEach } from 'vitest';
import { ScreeningChatService } from './ScreeningChatService.js';
import { testDb } from '../tests/setup.js';
import { users, startups, hackathons, applications } from '../db/schema.js';

describe('ScreeningChatService', () => {
  let service: ScreeningChatService;
  let founderId: string;
  let applicantId: string;
  let startupId: string;
  let hackathonId: string;
  let applicationId: string;

  beforeEach(async () => {
    // Create service with test database
    service = new ScreeningChatService(testDb);

    // Create test users
    const founderResult = await testDb.insert(users).values({
      email: 'founder@test.com',
      name: 'Test Founder',
      password: 'hashedpassword',
    }).returning();
    founderId = founderResult[0].id;

    const applicantResult = await testDb.insert(users).values({
      email: 'applicant@test.com',
      name: 'Test Applicant',
      password: 'hashedpassword',
    }).returning();
    applicantId = applicantResult[0].id;

    // Create test startup
    const startupResult = await testDb.insert(startups).values({
      founderId,
      name: 'Test Startup',
      description: 'A test startup for screening',
      stage: 'Idea',
      skillsNeeded: ['JavaScript', 'React'],
    }).returning();
    startupId = startupResult[0].id;

    // Create test hackathon
    const hackathonResult = await testDb.insert(hackathons).values({
      creatorId: founderId,
      name: 'Test Hackathon',
      description: 'A test hackathon for screening',
      teamSize: 4,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      skillsNeeded: ['Python', 'Django'],
    }).returning();
    hackathonId = hackathonResult[0].id;

    // Create accepted application
    const applicationResult = await testDb.insert(applications).values({
      applicantId,
      postType: 'startup',
      postId: startupId,
      message: 'I would love to join your startup!',
      status: 'accepted',
    }).returning();
    applicationId = applicationResult[0].id;
  });

  describe('createScreeningChat', () => {
    it('should create screening chat for accepted startup application', async () => {
      const chat = await service.createScreeningChat(applicationId);

      expect(chat).toBeDefined();
      expect(chat.applicationId).toBe(applicationId);
      expect(chat.founderId).toBe(founderId);
      expect(chat.applicantId).toBe(applicantId);
      expect(chat.postType).toBe('startup');
      expect(chat.postId).toBe(startupId);
      expect(chat.postName).toBe('Test Startup');
      expect(chat.status).toBe('accepted');
    });

    it('should create screening chat for accepted hackathon application', async () => {
      // Create hackathon application
      const hackathonApp = await testDb.insert(applications).values({
        applicantId,
        postType: 'hackathon',
        postId: hackathonId,
        message: 'I want to join this hackathon!',
        status: 'accepted',
      }).returning();

      const chat = await service.createScreeningChat(hackathonApp[0].id);

      expect(chat).toBeDefined();
      expect(chat.founderId).toBe(founderId);
      expect(chat.applicantId).toBe(applicantId);
      expect(chat.postType).toBe('hackathon');
      expect(chat.postId).toBe(hackathonId);
      expect(chat.postName).toBe('Test Hackathon');
    });

    it('should throw error if application not found', async () => {
      await expect(
        service.createScreeningChat('non-existent-id')
      ).rejects.toThrow('Application not found');
    });

    it('should throw error if application not accepted', async () => {
      // Create pending application
      const pendingApp = await testDb.insert(applications).values({
        applicantId,
        postType: 'startup',
        postId: startupId,
        message: 'Pending application',
        status: 'pending',
      }).returning();

      await expect(
        service.createScreeningChat(pendingApp[0].id)
      ).rejects.toThrow('Application must be accepted to create screening chat');
    });

    it('should throw error if startup not found', async () => {
      // Create application with non-existent startup
      const invalidApp = await testDb.insert(applications).values({
        applicantId,
        postType: 'startup',
        postId: 'non-existent-startup',
        message: 'Test message',
        status: 'accepted',
      }).returning();

      await expect(
        service.createScreeningChat(invalidApp[0].id)
      ).rejects.toThrow('Startup not found');
    });

    it('should throw error if hackathon not found', async () => {
      // Create application with non-existent hackathon
      const invalidApp = await testDb.insert(applications).values({
        applicantId,
        postType: 'hackathon',
        postId: 'non-existent-hackathon',
        message: 'Test message',
        status: 'accepted',
      }).returning();

      await expect(
        service.createScreeningChat(invalidApp[0].id)
      ).rejects.toThrow('Hackathon not found');
    });
  });

  describe('getScreeningChat', () => {
    it('should allow founder to access screening chat', async () => {
      const chat = await service.getScreeningChat(applicationId, founderId);

      expect(chat).toBeDefined();
      expect(chat.founderId).toBe(founderId);
      expect(chat.applicantId).toBe(applicantId);
    });

    it('should allow applicant to access screening chat', async () => {
      const chat = await service.getScreeningChat(applicationId, applicantId);

      expect(chat).toBeDefined();
      expect(chat.founderId).toBe(founderId);
      expect(chat.applicantId).toBe(applicantId);
    });

    it('should deny access to unauthorized users', async () => {
      // Create another user
      const otherUser = await testDb.insert(users).values({
        email: 'other@test.com',
        name: 'Other User',
        password: 'hashedpassword',
      }).returning();

      await expect(
        service.getScreeningChat(applicationId, otherUser[0].id)
      ).rejects.toThrow('Access denied');
    });

    it('should throw error if screening chat not found', async () => {
      await expect(
        service.getScreeningChat('non-existent-id', founderId)
      ).rejects.toThrow('Screening chat not found');
    });
  });

  describe('getUserScreeningChats', () => {
    it('should return screening chats where user is applicant', async () => {
      const chats = await service.getUserScreeningChats(applicantId);

      expect(chats).toHaveLength(1);
      expect(chats[0].applicantId).toBe(applicantId);
      expect(chats[0].founderId).toBe(founderId);
    });

    it('should return screening chats where user is founder', async () => {
      const chats = await service.getUserScreeningChats(founderId);

      expect(chats).toHaveLength(1);
      expect(chats[0].founderId).toBe(founderId);
      expect(chats[0].applicantId).toBe(applicantId);
    });

    it('should return multiple screening chats for user', async () => {
      // Create another applicant
      const applicant2 = await testDb.insert(users).values({
        email: 'applicant2@test.com',
        name: 'Applicant 2',
        password: 'hashedpassword',
      }).returning();

      // Create another accepted application
      await testDb.insert(applications).values({
        applicantId: applicant2[0].id,
        postType: 'startup',
        postId: startupId,
        message: 'Another application',
        status: 'accepted',
      });

      const chats = await service.getUserScreeningChats(founderId);

      expect(chats).toHaveLength(2);
      expect(chats.every(chat => chat.founderId === founderId)).toBe(true);
    });

    it('should return empty array if user has no screening chats', async () => {
      // Create new user with no applications
      const newUser = await testDb.insert(users).values({
        email: 'newuser@test.com',
        name: 'New User',
        password: 'hashedpassword',
      }).returning();

      const chats = await service.getUserScreeningChats(newUser[0].id);

      expect(chats).toHaveLength(0);
    });

    it('should only return accepted applications', async () => {
      // Create pending and rejected applications
      await testDb.insert(applications).values([
        {
          applicantId,
          postType: 'startup',
          postId: startupId,
          message: 'Pending application',
          status: 'pending',
        },
        {
          applicantId,
          postType: 'startup',
          postId: startupId,
          message: 'Rejected application',
          status: 'rejected',
        },
      ]);

      const chats = await service.getUserScreeningChats(applicantId);

      // Should only return the one accepted application
      expect(chats).toHaveLength(1);
      expect(chats[0].status).toBe('accepted');
    });

    it('should handle both startup and hackathon applications', async () => {
      // Create accepted hackathon application
      await testDb.insert(applications).values({
        applicantId,
        postType: 'hackathon',
        postId: hackathonId,
        message: 'Hackathon application',
        status: 'accepted',
      });

      const chats = await service.getUserScreeningChats(applicantId);

      expect(chats).toHaveLength(2);
      expect(chats.some(chat => chat.postType === 'startup')).toBe(true);
      expect(chats.some(chat => chat.postType === 'hackathon')).toBe(true);
    });
  });

  describe('validateScreeningChatAccess', () => {
    it('should return authorized true for founder', async () => {
      const result = await service.validateScreeningChatAccess(applicationId, founderId);

      expect(result.authorized).toBe(true);
      expect(result.participants).toBeDefined();
      expect(result.participants?.founderId).toBe(founderId);
      expect(result.participants?.applicantId).toBe(applicantId);
    });

    it('should return authorized true for applicant', async () => {
      const result = await service.validateScreeningChatAccess(applicationId, applicantId);

      expect(result.authorized).toBe(true);
      expect(result.participants).toBeDefined();
      expect(result.participants?.founderId).toBe(founderId);
      expect(result.participants?.applicantId).toBe(applicantId);
    });

    it('should return authorized false for unauthorized user', async () => {
      // Create another user
      const otherUser = await testDb.insert(users).values({
        email: 'unauthorized@test.com',
        name: 'Unauthorized User',
        password: 'hashedpassword',
      }).returning();

      const result = await service.validateScreeningChatAccess(applicationId, otherUser[0].id);

      expect(result.authorized).toBe(false);
      expect(result.participants).toBeUndefined();
    });

    it('should return authorized false for non-existent chat', async () => {
      const result = await service.validateScreeningChatAccess('non-existent-id', founderId);

      expect(result.authorized).toBe(false);
      expect(result.participants).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty post name gracefully', async () => {
      // This shouldn't happen in practice, but test defensive coding
      const chat = await service.getScreeningChat(applicationId, founderId);
      expect(chat.postName).toBeTruthy();
    });

    it('should handle concurrent access to same screening chat', async () => {
      // Simulate concurrent access
      const [chat1, chat2] = await Promise.all([
        service.getScreeningChat(applicationId, founderId),
        service.getScreeningChat(applicationId, applicantId),
      ]);

      expect(chat1.id).toBe(chat2.id);
      expect(chat1.founderId).toBe(chat2.founderId);
      expect(chat1.applicantId).toBe(chat2.applicantId);
    });
  });
});
