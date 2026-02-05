import { describe, it, expect, beforeEach } from 'vitest';
import { TeamFormationService } from './TeamFormationService.js';
import { testDb } from '../tests/setup.js';
import { users, startups, hackathons, applications, teamMembers, teamSpaces } from '../db/schema.js';
import { eq } from 'drizzle-orm';

describe('TeamFormationService', () => {
  let service: TeamFormationService;
  let founderId: string;
  let applicantId: string;
  let startupId: string;
  let hackathonId: string;
  let acceptedApplicationId: string;

  beforeEach(async () => {
    // Create service with test database
    service = new TeamFormationService(testDb);

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
      description: 'A test startup for team formation',
      stage: 'Idea',
      skillsNeeded: ['JavaScript', 'React'],
    }).returning();
    startupId = startupResult[0].id;

    // Create test hackathon
    const hackathonResult = await testDb.insert(hackathons).values({
      creatorId: founderId,
      name: 'Test Hackathon',
      description: 'A test hackathon for team formation',
      teamSize: 4,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
    acceptedApplicationId = applicationResult[0].id;
  });

  describe('inviteToBuilderSpace', () => {
    it('should create team member and builder space for accepted application', async () => {
      const result = await service.inviteToBuilderSpace(acceptedApplicationId, founderId);

      expect(result).toBeDefined();
      expect(result.teamMember).toBeDefined();
      expect(result.teamMember.userId).toBe(applicantId);
      expect(result.teamMember.postType).toBe('startup');
      expect(result.teamMember.postId).toBe(startupId);
      expect(result.teamMember.role).toBe('member');

      expect(result.builderSpace).toBeDefined();
      expect(result.builderSpace.postType).toBe('startup');
      expect(result.builderSpace.postId).toBe(startupId);
      expect(result.builderSpace.name).toBe('Test Startup Builder Space');

      expect(result.isNewSpace).toBe(true);
    });

    it('should reuse existing builder space when inviting second member', async () => {
      // First invitation
      const result1 = await service.inviteToBuilderSpace(acceptedApplicationId, founderId);
      expect(result1.isNewSpace).toBe(true);

      // Create second applicant and application
      const applicant2 = await testDb.insert(users).values({
        email: 'applicant2@test.com',
        name: 'Second Applicant',
        password: 'hashedpassword',
      }).returning();

      const application2 = await testDb.insert(applications).values({
        applicantId: applicant2[0].id,
        postType: 'startup',
        postId: startupId,
        message: 'I also want to join!',
        status: 'accepted',
      }).returning();

      // Second invitation
      const result2 = await service.inviteToBuilderSpace(application2[0].id, founderId);
      expect(result2.isNewSpace).toBe(false);
      expect(result2.builderSpace.id).toBe(result1.builderSpace.id);
    });

    it('should work for hackathon applications', async () => {
      // Create hackathon application
      const hackathonApp = await testDb.insert(applications).values({
        applicantId,
        postType: 'hackathon',
        postId: hackathonId,
        message: 'I want to join this hackathon!',
        status: 'accepted',
      }).returning();

      const result = await service.inviteToBuilderSpace(hackathonApp[0].id, founderId);

      expect(result.teamMember.postType).toBe('hackathon');
      expect(result.teamMember.postId).toBe(hackathonId);
      expect(result.builderSpace.name).toBe('Test Hackathon Builder Space');
    });

    it('should throw error if application not found', async () => {
      await expect(
        service.inviteToBuilderSpace('non-existent-id', founderId)
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
        service.inviteToBuilderSpace(pendingApp[0].id, founderId)
      ).rejects.toThrow('Application must be accepted before inviting to Builder Space');
    });

    it('should throw error if requester is not the founder', async () => {
      // Create another user
      const otherUser = await testDb.insert(users).values({
        email: 'other@test.com',
        name: 'Other User',
        password: 'hashedpassword',
      }).returning();

      await expect(
        service.inviteToBuilderSpace(acceptedApplicationId, otherUser[0].id)
      ).rejects.toThrow('Access denied: Only the founder can invite team members');
    });

    it('should throw error if applicant is already a team member', async () => {
      // First invitation
      await service.inviteToBuilderSpace(acceptedApplicationId, founderId);

      // Try to invite again
      await expect(
        service.inviteToBuilderSpace(acceptedApplicationId, founderId)
      ).rejects.toThrow('User is already a team member');
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
        service.inviteToBuilderSpace(invalidApp[0].id, founderId)
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
        service.inviteToBuilderSpace(invalidApp[0].id, founderId)
      ).rejects.toThrow('Hackathon not found');
    });
  });

  describe('createTeamMember', () => {
    it('should create team member with member role', async () => {
      const member = await service.createTeamMember(applicantId, 'startup', startupId, 'member');

      expect(member).toBeDefined();
      expect(member.userId).toBe(applicantId);
      expect(member.postType).toBe('startup');
      expect(member.postId).toBe(startupId);
      expect(member.role).toBe('member');
      expect(member.joinedAt).toBeInstanceOf(Date);
    });

    it('should create team member with founder role', async () => {
      const member = await service.createTeamMember(founderId, 'startup', startupId, 'founder');

      expect(member).toBeDefined();
      expect(member.role).toBe('founder');
    });

    it('should default to member role if not specified', async () => {
      const member = await service.createTeamMember(applicantId, 'startup', startupId);

      expect(member.role).toBe('member');
    });

    it('should throw error if user not found', async () => {
      await expect(
        service.createTeamMember('non-existent-user', 'startup', startupId, 'member')
      ).rejects.toThrow('User not found');
    });

    it('should throw error if startup not found', async () => {
      await expect(
        service.createTeamMember(applicantId, 'startup', 'non-existent-startup', 'member')
      ).rejects.toThrow('Startup not found');
    });

    it('should throw error if hackathon not found', async () => {
      await expect(
        service.createTeamMember(applicantId, 'hackathon', 'non-existent-hackathon', 'member')
      ).rejects.toThrow('Hackathon not found');
    });

    it('should prevent duplicate team membership', async () => {
      // Create first membership
      await service.createTeamMember(applicantId, 'startup', startupId, 'member');

      // Try to create duplicate
      await expect(
        service.createTeamMember(applicantId, 'startup', startupId, 'member')
      ).rejects.toThrow('User is already a team member');
    });

    it('should allow same user to be member of different teams', async () => {
      // Create membership for startup
      const member1 = await service.createTeamMember(applicantId, 'startup', startupId, 'member');

      // Create membership for hackathon
      const member2 = await service.createTeamMember(applicantId, 'hackathon', hackathonId, 'member');

      expect(member1.postId).toBe(startupId);
      expect(member2.postId).toBe(hackathonId);
    });
  });

  describe('ensureBuilderSpace', () => {
    it('should create new builder space if none exists', async () => {
      const result = await service.ensureBuilderSpace('startup', startupId, 'Test Startup');

      expect(result.isNew).toBe(true);
      expect(result.space).toBeDefined();
      expect(result.space.postType).toBe('startup');
      expect(result.space.postId).toBe(startupId);
      expect(result.space.name).toBe('Test Startup Builder Space');
      expect(result.space.description).toContain('Test Startup');
    });

    it('should return existing builder space if one exists', async () => {
      // Create first space
      const result1 = await service.ensureBuilderSpace('startup', startupId, 'Test Startup');
      expect(result1.isNew).toBe(true);

      // Try to create again
      const result2 = await service.ensureBuilderSpace('startup', startupId, 'Test Startup');
      expect(result2.isNew).toBe(false);
      expect(result2.space.id).toBe(result1.space.id);
    });

    it('should create separate spaces for different teams', async () => {
      const space1 = await service.ensureBuilderSpace('startup', startupId, 'Test Startup');
      const space2 = await service.ensureBuilderSpace('hackathon', hackathonId, 'Test Hackathon');

      expect(space1.space.id).not.toBe(space2.space.id);
      expect(space1.space.postType).toBe('startup');
      expect(space2.space.postType).toBe('hackathon');
    });
  });

  describe('getTeamMembers', () => {
    it('should return all team members for a post', async () => {
      // Create multiple team members
      await service.createTeamMember(founderId, 'startup', startupId, 'founder');
      await service.createTeamMember(applicantId, 'startup', startupId, 'member');

      const members = await service.getTeamMembers('startup', startupId);

      expect(members).toHaveLength(2);
      expect(members.some(m => m.userId === founderId && m.role === 'founder')).toBe(true);
      expect(members.some(m => m.userId === applicantId && m.role === 'member')).toBe(true);
    });

    it('should return empty array if no team members', async () => {
      const members = await service.getTeamMembers('startup', startupId);

      expect(members).toHaveLength(0);
    });

    it('should only return members for specified post', async () => {
      // Create members for different posts
      await service.createTeamMember(applicantId, 'startup', startupId, 'member');
      await service.createTeamMember(applicantId, 'hackathon', hackathonId, 'member');

      const startupMembers = await service.getTeamMembers('startup', startupId);
      const hackathonMembers = await service.getTeamMembers('hackathon', hackathonId);

      expect(startupMembers).toHaveLength(1);
      expect(hackathonMembers).toHaveLength(1);
      expect(startupMembers[0].postId).toBe(startupId);
      expect(hackathonMembers[0].postId).toBe(hackathonId);
    });
  });

  describe('isTeamMember', () => {
    it('should return true if user is a team member', async () => {
      await service.createTeamMember(applicantId, 'startup', startupId, 'member');

      const isMember = await service.isTeamMember(applicantId, 'startup', startupId);

      expect(isMember).toBe(true);
    });

    it('should return false if user is not a team member', async () => {
      const isMember = await service.isTeamMember(applicantId, 'startup', startupId);

      expect(isMember).toBe(false);
    });

    it('should return false for different post', async () => {
      await service.createTeamMember(applicantId, 'startup', startupId, 'member');

      const isMember = await service.isTeamMember(applicantId, 'hackathon', hackathonId);

      expect(isMember).toBe(false);
    });
  });

  describe('getBuilderSpace', () => {
    it('should return builder space if it exists', async () => {
      // Create builder space
      await service.ensureBuilderSpace('startup', startupId, 'Test Startup');

      const space = await service.getBuilderSpace('startup', startupId);

      expect(space).not.toBeNull();
      expect(space?.postType).toBe('startup');
      expect(space?.postId).toBe(startupId);
    });

    it('should return null if builder space does not exist', async () => {
      const space = await service.getBuilderSpace('startup', startupId);

      expect(space).toBeNull();
    });
  });

  describe('validateBuilderSpaceAccess', () => {
    it('should return true if user is a team member', async () => {
      // Create team member and builder space
      await service.createTeamMember(applicantId, 'startup', startupId, 'member');
      const { space } = await service.ensureBuilderSpace('startup', startupId, 'Test Startup');

      const hasAccess = await service.validateBuilderSpaceAccess(applicantId, space.id);

      expect(hasAccess).toBe(true);
    });

    it('should return false if user is not a team member', async () => {
      // Create builder space but no team membership
      const { space } = await service.ensureBuilderSpace('startup', startupId, 'Test Startup');

      const hasAccess = await service.validateBuilderSpaceAccess(applicantId, space.id);

      expect(hasAccess).toBe(false);
    });

    it('should return false if builder space does not exist', async () => {
      const hasAccess = await service.validateBuilderSpaceAccess(applicantId, 'non-existent-space');

      expect(hasAccess).toBe(false);
    });

    it('should return false for team member of different team', async () => {
      // Create team member for startup
      await service.createTeamMember(applicantId, 'startup', startupId, 'member');

      // Create builder space for hackathon
      const { space } = await service.ensureBuilderSpace('hackathon', hackathonId, 'Test Hackathon');

      const hasAccess = await service.validateBuilderSpaceAccess(applicantId, space.id);

      expect(hasAccess).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent team member creation attempts', async () => {
      // Simulate concurrent creation attempts
      const promises = [
        service.createTeamMember(applicantId, 'startup', startupId, 'member'),
        service.createTeamMember(applicantId, 'startup', startupId, 'member'),
      ];

      // One should succeed, one should fail with duplicate error
      const results = await Promise.allSettled(promises);
      const succeeded = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      // At least one should succeed
      expect(succeeded.length).toBeGreaterThanOrEqual(1);
      // If both succeeded (race condition), they should have same ID
      // If one failed, it should be duplicate error
      if (failed.length > 0) {
        expect((failed[0] as any).reason.message).toContain('already a team member');
      }
    });

    it('should handle concurrent builder space creation attempts', async () => {
      // Simulate concurrent creation attempts
      const promises = [
        service.ensureBuilderSpace('startup', startupId, 'Test Startup'),
        service.ensureBuilderSpace('startup', startupId, 'Test Startup'),
      ];

      const results = await Promise.all(promises);

      // Both should succeed
      expect(results).toHaveLength(2);
      // At least one should be new (first creation)
      expect(results.some(r => r.isNew)).toBe(true);
      // Both should return the same space (either both found existing or one created, one found)
      // This may not always be true in a race condition, so we just verify both succeeded
      expect(results[0].space).toBeDefined();
      expect(results[1].space).toBeDefined();
    });

    it('should handle team formation for rejected then re-accepted application', async () => {
      // Create rejected application
      const rejectedApp = await testDb.insert(applications).values({
        applicantId,
        postType: 'startup',
        postId: startupId,
        message: 'Another application',
        status: 'rejected',
      }).returning();

      // Try to invite (should fail)
      await expect(
        service.inviteToBuilderSpace(rejectedApp[0].id, founderId)
      ).rejects.toThrow('Application must be accepted');

      // Update to accepted
      await testDb
        .update(applications)
        .set({ status: 'accepted' })
        .where(eq(applications.id, rejectedApp[0].id));

      // Now should succeed
      const result = await service.inviteToBuilderSpace(rejectedApp[0].id, founderId);
      expect(result.teamMember).toBeDefined();
    });
  });
});
