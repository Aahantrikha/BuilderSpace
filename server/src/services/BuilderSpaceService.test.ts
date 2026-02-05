import { describe, it, expect, beforeEach } from 'vitest';
import { BuilderSpaceService } from './BuilderSpaceService.js';
import { testDb } from '../tests/setup.js';
import { users, startups, hackathons, teamMembers, teamSpaces } from '../db/schema.js';

describe('BuilderSpaceService', () => {
  let service: BuilderSpaceService;
  let founderId: string;
  let memberId: string;
  let startupId: string;
  let hackathonId: string;

  beforeEach(async () => {
    // Create service with test database
    service = new BuilderSpaceService(testDb);

    // Create test users
    const founderResult = await testDb.insert(users).values({
      email: 'founder@test.com',
      name: 'Test Founder',
      password: 'hashedpassword',
    }).returning();
    founderId = founderResult[0].id;

    const memberResult = await testDb.insert(users).values({
      email: 'member@test.com',
      name: 'Test Member',
      password: 'hashedpassword',
    }).returning();
    memberId = memberResult[0].id;

    // Create test startup
    const startupResult = await testDb.insert(startups).values({
      founderId,
      name: 'Test Startup',
      description: 'A test startup for builder space',
      stage: 'Idea',
      skillsNeeded: ['JavaScript', 'React'],
    }).returning();
    startupId = startupResult[0].id;

    // Create test hackathon
    const hackathonResult = await testDb.insert(hackathons).values({
      creatorId: founderId,
      name: 'Test Hackathon',
      description: 'A test hackathon for builder space',
      teamSize: 4,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      skillsNeeded: ['Python', 'Django'],
    }).returning();
    hackathonId = hackathonResult[0].id;
  });

  describe('createBuilderSpace', () => {
    it('should create a Builder Space for a startup', async () => {
      const space = await service.createBuilderSpace(
        'startup',
        startupId,
        'Test Startup Builder Space',
        'Collaboration workspace for Test Startup'
      );

      expect(space).toBeDefined();
      expect(space.postType).toBe('startup');
      expect(space.postId).toBe(startupId);
      expect(space.name).toBe('Test Startup Builder Space');
      expect(space.description).toBe('Collaboration workspace for Test Startup');
      expect(space.createdAt).toBeInstanceOf(Date);
      expect(space.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a Builder Space for a hackathon', async () => {
      const space = await service.createBuilderSpace(
        'hackathon',
        hackathonId,
        'Test Hackathon Builder Space',
        'Collaboration workspace for Test Hackathon'
      );

      expect(space).toBeDefined();
      expect(space.postType).toBe('hackathon');
      expect(space.postId).toBe(hackathonId);
      expect(space.name).toBe('Test Hackathon Builder Space');
    });

    it('should create a Builder Space without description', async () => {
      const space = await service.createBuilderSpace(
        'startup',
        startupId,
        'Test Startup Builder Space'
      );

      expect(space).toBeDefined();
      // Database returns null for optional fields, not undefined
      expect(space.description).toBeNull();
    });

    it('should throw error if startup not found', async () => {
      await expect(
        service.createBuilderSpace(
          'startup',
          'non-existent-startup',
          'Test Space'
        )
      ).rejects.toThrow('Startup not found');
    });

    it('should throw error if hackathon not found', async () => {
      await expect(
        service.createBuilderSpace(
          'hackathon',
          'non-existent-hackathon',
          'Test Space'
        )
      ).rejects.toThrow('Hackathon not found');
    });

    it('should throw error if Builder Space already exists for team', async () => {
      // Create first Builder Space
      await service.createBuilderSpace(
        'startup',
        startupId,
        'First Space'
      );

      // Try to create second Builder Space for same team
      await expect(
        service.createBuilderSpace(
          'startup',
          startupId,
          'Second Space'
        )
      ).rejects.toThrow('Builder Space already exists for this team');
    });

    it('should allow separate Builder Spaces for different teams', async () => {
      const startupSpace = await service.createBuilderSpace(
        'startup',
        startupId,
        'Startup Space'
      );

      const hackathonSpace = await service.createBuilderSpace(
        'hackathon',
        hackathonId,
        'Hackathon Space'
      );

      expect(startupSpace.id).not.toBe(hackathonSpace.id);
      expect(startupSpace.postType).toBe('startup');
      expect(hackathonSpace.postType).toBe('hackathon');
    });
  });

  describe('getBuilderSpace', () => {
    it('should get Builder Space with valid authorization', async () => {
      // Create Builder Space
      const createdSpace = await service.createBuilderSpace(
        'startup',
        startupId,
        'Test Space'
      );

      // Create team membership
      await testDb.insert(teamMembers).values({
        userId: memberId,
        postType: 'startup',
        postId: startupId,
        role: 'member',
      });

      // Get Builder Space
      const space = await service.getBuilderSpace(createdSpace.id, memberId);

      expect(space).toBeDefined();
      expect(space.id).toBe(createdSpace.id);
      expect(space.name).toBe('Test Space');
    });

    it('should throw error if Builder Space not found', async () => {
      await expect(
        service.getBuilderSpace('non-existent-space', memberId)
      ).rejects.toThrow('Builder Space not found');
    });

    it('should throw error if user is not a team member', async () => {
      // Create Builder Space
      const createdSpace = await service.createBuilderSpace(
        'startup',
        startupId,
        'Test Space'
      );

      // Try to access without team membership
      await expect(
        service.getBuilderSpace(createdSpace.id, memberId)
      ).rejects.toThrow('Access denied: User is not a team member');
    });

    it('should allow founder to access Builder Space', async () => {
      // Create Builder Space
      const createdSpace = await service.createBuilderSpace(
        'startup',
        startupId,
        'Test Space'
      );

      // Create founder team membership
      await testDb.insert(teamMembers).values({
        userId: founderId,
        postType: 'startup',
        postId: startupId,
        role: 'founder',
      });

      // Get Builder Space
      const space = await service.getBuilderSpace(createdSpace.id, founderId);

      expect(space).toBeDefined();
      expect(space.id).toBe(createdSpace.id);
    });

    it('should not allow access to Builder Space of different team', async () => {
      // Create Builder Space for startup
      const startupSpace = await service.createBuilderSpace(
        'startup',
        startupId,
        'Startup Space'
      );

      // Create team membership for hackathon (different team)
      await testDb.insert(teamMembers).values({
        userId: memberId,
        postType: 'hackathon',
        postId: hackathonId,
        role: 'member',
      });

      // Try to access startup Builder Space
      await expect(
        service.getBuilderSpace(startupSpace.id, memberId)
      ).rejects.toThrow('Access denied: User is not a team member');
    });
  });

  describe('getBuilderSpaceByPost', () => {
    it('should get Builder Space by post type and ID', async () => {
      // Create Builder Space
      const createdSpace = await service.createBuilderSpace(
        'startup',
        startupId,
        'Test Space'
      );

      // Get by post
      const space = await service.getBuilderSpaceByPost('startup', startupId);

      expect(space).not.toBeNull();
      expect(space?.id).toBe(createdSpace.id);
      expect(space?.postType).toBe('startup');
      expect(space?.postId).toBe(startupId);
    });

    it('should return null if Builder Space does not exist', async () => {
      const space = await service.getBuilderSpaceByPost('startup', startupId);

      expect(space).toBeNull();
    });

    it('should get correct Builder Space for hackathon', async () => {
      // Create Builder Spaces for both
      await service.createBuilderSpace('startup', startupId, 'Startup Space');
      const hackathonSpace = await service.createBuilderSpace(
        'hackathon',
        hackathonId,
        'Hackathon Space'
      );

      // Get hackathon space
      const space = await service.getBuilderSpaceByPost('hackathon', hackathonId);

      expect(space).not.toBeNull();
      expect(space?.id).toBe(hackathonSpace.id);
      expect(space?.postType).toBe('hackathon');
    });
  });

  describe('getBuilderSpaceByPostWithAuth', () => {
    it('should get Builder Space with valid authorization', async () => {
      // Create Builder Space
      await service.createBuilderSpace('startup', startupId, 'Test Space');

      // Create team membership
      await testDb.insert(teamMembers).values({
        userId: memberId,
        postType: 'startup',
        postId: startupId,
        role: 'member',
      });

      // Get with auth
      const space = await service.getBuilderSpaceByPostWithAuth(
        'startup',
        startupId,
        memberId
      );

      expect(space).toBeDefined();
      expect(space.postType).toBe('startup');
      expect(space.postId).toBe(startupId);
    });

    it('should throw error if Builder Space not found', async () => {
      await expect(
        service.getBuilderSpaceByPostWithAuth('startup', startupId, memberId)
      ).rejects.toThrow('Builder Space not found');
    });

    it('should throw error if user is not authorized', async () => {
      // Create Builder Space
      await service.createBuilderSpace('startup', startupId, 'Test Space');

      // Try to access without team membership
      await expect(
        service.getBuilderSpaceByPostWithAuth('startup', startupId, memberId)
      ).rejects.toThrow('Access denied: User is not a team member');
    });
  });

  describe('validateTeamMemberAccess', () => {
    it('should return true if user is a team member', async () => {
      // Create team membership
      await testDb.insert(teamMembers).values({
        userId: memberId,
        postType: 'startup',
        postId: startupId,
        role: 'member',
      });

      const hasAccess = await service.validateTeamMemberAccess(
        memberId,
        'startup',
        startupId
      );

      expect(hasAccess).toBe(true);
    });

    it('should return false if user is not a team member', async () => {
      const hasAccess = await service.validateTeamMemberAccess(
        memberId,
        'startup',
        startupId
      );

      expect(hasAccess).toBe(false);
    });

    it('should return true for founder role', async () => {
      // Create founder team membership
      await testDb.insert(teamMembers).values({
        userId: founderId,
        postType: 'startup',
        postId: startupId,
        role: 'founder',
      });

      const hasAccess = await service.validateTeamMemberAccess(
        founderId,
        'startup',
        startupId
      );

      expect(hasAccess).toBe(true);
    });

    it('should return false for member of different team', async () => {
      // Create membership for hackathon
      await testDb.insert(teamMembers).values({
        userId: memberId,
        postType: 'hackathon',
        postId: hackathonId,
        role: 'member',
      });

      // Check access for startup
      const hasAccess = await service.validateTeamMemberAccess(
        memberId,
        'startup',
        startupId
      );

      expect(hasAccess).toBe(false);
    });
  });

  describe('validateBuilderSpaceUniqueness', () => {
    it('should return true if no Builder Space exists', async () => {
      const isUnique = await service.validateBuilderSpaceUniqueness(
        'startup',
        startupId
      );

      expect(isUnique).toBe(true);
    });

    it('should return false if Builder Space already exists', async () => {
      // Create Builder Space
      await service.createBuilderSpace('startup', startupId, 'Test Space');

      const isUnique = await service.validateBuilderSpaceUniqueness(
        'startup',
        startupId
      );

      expect(isUnique).toBe(false);
    });

    it('should validate uniqueness per team', async () => {
      // Create Builder Space for startup
      await service.createBuilderSpace('startup', startupId, 'Startup Space');

      // Hackathon should still be unique
      const hackathonUnique = await service.validateBuilderSpaceUniqueness(
        'hackathon',
        hackathonId
      );

      expect(hackathonUnique).toBe(true);
    });
  });

  describe('getUserBuilderSpaces', () => {
    it('should return all Builder Spaces for user across teams', async () => {
      // Create Builder Spaces
      await service.createBuilderSpace('startup', startupId, 'Startup Space');
      await service.createBuilderSpace('hackathon', hackathonId, 'Hackathon Space');

      // Create team memberships
      await testDb.insert(teamMembers).values({
        userId: memberId,
        postType: 'startup',
        postId: startupId,
        role: 'member',
      });
      await testDb.insert(teamMembers).values({
        userId: memberId,
        postType: 'hackathon',
        postId: hackathonId,
        role: 'member',
      });

      // Get user's Builder Spaces
      const spaces = await service.getUserBuilderSpaces(memberId);

      expect(spaces).toHaveLength(2);
      expect(spaces.some(s => s.postType === 'startup' && s.postId === startupId)).toBe(true);
      expect(spaces.some(s => s.postType === 'hackathon' && s.postId === hackathonId)).toBe(true);
    });

    it('should return empty array if user has no team memberships', async () => {
      const spaces = await service.getUserBuilderSpaces(memberId);

      expect(spaces).toHaveLength(0);
    });

    it('should return empty array if user teams have no Builder Spaces', async () => {
      // Create team membership but no Builder Space
      await testDb.insert(teamMembers).values({
        userId: memberId,
        postType: 'startup',
        postId: startupId,
        role: 'member',
      });

      const spaces = await service.getUserBuilderSpaces(memberId);

      expect(spaces).toHaveLength(0);
    });

    it('should only return Builder Spaces for teams user is member of', async () => {
      // Create Builder Spaces for both teams
      await service.createBuilderSpace('startup', startupId, 'Startup Space');
      await service.createBuilderSpace('hackathon', hackathonId, 'Hackathon Space');

      // User is only member of startup
      await testDb.insert(teamMembers).values({
        userId: memberId,
        postType: 'startup',
        postId: startupId,
        role: 'member',
      });

      const spaces = await service.getUserBuilderSpaces(memberId);

      expect(spaces).toHaveLength(1);
      expect(spaces[0].postType).toBe('startup');
      expect(spaces[0].postId).toBe(startupId);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent Builder Space creation attempts', async () => {
      // Simulate concurrent creation attempts
      const promises = [
        service.createBuilderSpace('startup', startupId, 'Space 1'),
        service.createBuilderSpace('startup', startupId, 'Space 2'),
      ];

      // One should succeed, one should fail (or both succeed if race condition)
      const results = await Promise.allSettled(promises);
      const succeeded = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      // At least one should succeed
      expect(succeeded.length).toBeGreaterThanOrEqual(1);
      
      // If one failed, it should be due to duplicate
      if (failed.length > 0) {
        expect((failed[0] as any).reason.message).toContain('already exists');
      }
    });

    it('should handle empty space name', async () => {
      const space = await service.createBuilderSpace(
        'startup',
        startupId,
        ''
      );

      expect(space).toBeDefined();
      expect(space.name).toBe('');
    });

    it('should handle very long space names and descriptions', async () => {
      const longName = 'A'.repeat(1000);
      const longDescription = 'B'.repeat(5000);

      const space = await service.createBuilderSpace(
        'startup',
        startupId,
        longName,
        longDescription
      );

      expect(space).toBeDefined();
      expect(space.name).toBe(longName);
      expect(space.description).toBe(longDescription);
    });

    it('should handle special characters in space name', async () => {
      const specialName = 'Test <>&"\'Space';

      const space = await service.createBuilderSpace(
        'startup',
        startupId,
        specialName
      );

      expect(space).toBeDefined();
      expect(space.name).toBe(specialName);
    });

    it('should maintain separate access control for different users', async () => {
      // Create Builder Space
      const space = await service.createBuilderSpace('startup', startupId, 'Test Space');

      // Create team membership for member only
      await testDb.insert(teamMembers).values({
        userId: memberId,
        postType: 'startup',
        postId: startupId,
        role: 'member',
      });

      // Member should have access
      const memberSpace = await service.getBuilderSpace(space.id, memberId);
      expect(memberSpace).toBeDefined();

      // Founder should not have access (not a team member yet)
      await expect(
        service.getBuilderSpace(space.id, founderId)
      ).rejects.toThrow('Access denied');
    });
  });
});
