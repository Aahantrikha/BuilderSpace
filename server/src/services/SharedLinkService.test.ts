import { describe, it, expect, beforeEach } from 'vitest';
import { SharedLinkService } from './SharedLinkService.js';
import { BuilderSpaceService } from './BuilderSpaceService.js';
import { TeamFormationService } from './TeamFormationService.js';
import { testDb } from '../tests/setup.js';
import { users, startups, applications, spaceLinks } from '../db/schema.js';
import { eq } from 'drizzle-orm';

describe('SharedLinkService', () => {
  let sharedLinkService: SharedLinkService;
  let builderSpaceService: BuilderSpaceService;
  let teamFormationService: TeamFormationService;

  // Test data
  let founderId: string;
  let memberId: string;
  let nonMemberId: string;
  let startupId: string;
  let applicationId: string;
  let spaceId: string;

  beforeEach(async () => {
    // Initialize services with test database
    sharedLinkService = new SharedLinkService(testDb);
    builderSpaceService = new BuilderSpaceService(testDb);
    teamFormationService = new TeamFormationService(testDb);

    // Create test users
    const founder = await testDb.insert(users).values({
      email: 'founder@test.com',
      name: 'Founder User',
      password: 'password123',
    }).returning();
    founderId = founder[0].id;

    const member = await testDb.insert(users).values({
      email: 'member@test.com',
      name: 'Member User',
      password: 'password123',
    }).returning();
    memberId = member[0].id;

    const nonMember = await testDb.insert(users).values({
      email: 'nonmember@test.com',
      name: 'Non-Member User',
      password: 'password123',
    }).returning();
    nonMemberId = nonMember[0].id;

    // Create test startup
    const startup = await testDb.insert(startups).values({
      founderId,
      name: 'Test Startup',
      description: 'A test startup for link management',
      stage: 'Idea',
      skillsNeeded: ['JavaScript', 'React'],
    }).returning();
    startupId = startup[0].id;

    // Create application
    const application = await testDb.insert(applications).values({
      applicantId: memberId,
      postType: 'startup',
      postId: startupId,
      message: 'I want to join',
      status: 'accepted',
    }).returning();
    applicationId = application[0].id;

    // Create team members (founder and member)
    await teamFormationService.createTeamMember(founderId, 'startup', startupId, 'founder');
    await teamFormationService.createTeamMember(memberId, 'startup', startupId, 'member');

    // Create Builder Space
    const space = await builderSpaceService.createBuilderSpace(
      'startup',
      startupId,
      'Test Startup Builder Space'
    );
    spaceId = space.id;
  });

  describe('addSharedLink', () => {
    it('should add a shared link with valid URL', async () => {
      const link = await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: founderId,
        title: 'GitHub Repository',
        url: 'https://github.com/test/repo',
        description: 'Our main repository',
      });

      expect(link).toBeDefined();
      expect(link.id).toBeDefined();
      expect(link.spaceId).toBe(spaceId);
      expect(link.creatorId).toBe(founderId);
      expect(link.creatorName).toBe('Founder User');
      expect(link.title).toBe('GitHub Repository');
      expect(link.url).toBe('https://github.com/test/repo');
      expect(link.description).toBe('Our main repository');
      expect(link.createdAt).toBeInstanceOf(Date);
      expect(link.updatedAt).toBeInstanceOf(Date);
    });

    it('should add a shared link without description', async () => {
      const link = await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: memberId,
        title: 'Figma Design',
        url: 'https://figma.com/file/test',
      });

      expect(link).toBeDefined();
      expect(link.title).toBe('Figma Design');
      expect(link.url).toBe('https://figma.com/file/test');
      expect(link.description).toBeUndefined();
    });

    it('should trim whitespace from URL', async () => {
      const link = await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: founderId,
        title: 'Test Link',
        url: '  https://example.com/test  ',
      });

      expect(link.url).toBe('https://example.com/test');
    });

    it('should trim whitespace from title', async () => {
      const link = await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: founderId,
        title: '  Test Link  ',
        url: 'https://example.com/test',
      });

      expect(link.title).toBe('Test Link');
    });

    it('should reject invalid URL format', async () => {
      await expect(
        sharedLinkService.addSharedLink({
          spaceId,
          creatorId: founderId,
          title: 'Invalid Link',
          url: 'not-a-valid-url',
        })
      ).rejects.toThrow('Invalid URL format');
    });

    it('should reject URL without protocol', async () => {
      await expect(
        sharedLinkService.addSharedLink({
          spaceId,
          creatorId: founderId,
          title: 'No Protocol',
          url: 'example.com',
        })
      ).rejects.toThrow('Invalid URL format');
    });

    it('should reject URL with invalid protocol', async () => {
      await expect(
        sharedLinkService.addSharedLink({
          spaceId,
          creatorId: founderId,
          title: 'FTP Link',
          url: 'ftp://example.com',
        })
      ).rejects.toThrow('Protocol ftp: is not allowed for security reasons');
    });

    it('should reject empty URL', async () => {
      await expect(
        sharedLinkService.addSharedLink({
          spaceId,
          creatorId: founderId,
          title: 'Empty URL',
          url: '',
        })
      ).rejects.toThrow('URL cannot be empty');
    });

    it('should reject empty title', async () => {
      await expect(
        sharedLinkService.addSharedLink({
          spaceId,
          creatorId: founderId,
          title: '',
          url: 'https://example.com',
        })
      ).rejects.toThrow('Title cannot be empty');
    });

    it('should reject title that is too long', async () => {
      const longTitle = 'a'.repeat(201);
      await expect(
        sharedLinkService.addSharedLink({
          spaceId,
          creatorId: founderId,
          title: longTitle,
          url: 'https://example.com',
        })
      ).rejects.toThrow('Title cannot exceed 200 characters');
    });

    it('should reject description that is too long', async () => {
      const longDescription = 'a'.repeat(1001);
      await expect(
        sharedLinkService.addSharedLink({
          spaceId,
          creatorId: founderId,
          title: 'Test Link',
          url: 'https://example.com',
          description: longDescription,
        })
      ).rejects.toThrow('Description cannot exceed 1000 characters');
    });

    it('should reject non-team member adding link', async () => {
      await expect(
        sharedLinkService.addSharedLink({
          spaceId,
          creatorId: nonMemberId,
          title: 'Unauthorized Link',
          url: 'https://example.com',
        })
      ).rejects.toThrow('Access denied: You are not authorized to add links to this Builder Space');
    });

    it('should reject adding link to non-existent space', async () => {
      await expect(
        sharedLinkService.addSharedLink({
          spaceId: 'non-existent-space',
          creatorId: founderId,
          title: 'Test Link',
          url: 'https://example.com',
        })
      ).rejects.toThrow('Builder Space not found');
    });

    it('should allow both founder and member to add links', async () => {
      const founderLink = await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: founderId,
        title: 'Founder Link',
        url: 'https://example.com/founder',
      });

      const memberLink = await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: memberId,
        title: 'Member Link',
        url: 'https://example.com/member',
      });

      expect(founderLink.creatorId).toBe(founderId);
      expect(memberLink.creatorId).toBe(memberId);
    });
  });

  describe('removeSharedLink', () => {
    let linkId: string;

    beforeEach(async () => {
      const link = await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: founderId,
        title: 'Test Link',
        url: 'https://example.com',
      });
      linkId = link.id;
    });

    it('should allow creator to remove their own link', async () => {
      await expect(
        sharedLinkService.removeSharedLink(linkId, founderId)
      ).resolves.not.toThrow();

      // Verify link is deleted
      const links = await testDb
        .select()
        .from(spaceLinks)
        .where(eq(spaceLinks.id, linkId));

      expect(links.length).toBe(0);
    });

    it('should reject non-creator removing link', async () => {
      await expect(
        sharedLinkService.removeSharedLink(linkId, memberId)
      ).rejects.toThrow('Access denied: Only the link creator can remove this link');
    });

    it('should reject non-team member removing link', async () => {
      await expect(
        sharedLinkService.removeSharedLink(linkId, nonMemberId)
      ).rejects.toThrow('Access denied: Only the link creator can remove this link');
    });

    it('should reject removing non-existent link', async () => {
      await expect(
        sharedLinkService.removeSharedLink('non-existent-link', founderId)
      ).rejects.toThrow('Link not found');
    });

    it('should allow creator to remove link even if they created multiple links', async () => {
      // Create another link
      const link2 = await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: founderId,
        title: 'Second Link',
        url: 'https://example.com/2',
      });

      // Remove first link
      await sharedLinkService.removeSharedLink(linkId, founderId);

      // Verify first link is deleted but second remains
      const links = await testDb
        .select()
        .from(spaceLinks)
        .where(eq(spaceLinks.spaceId, spaceId));

      expect(links.length).toBe(1);
      expect(links[0].id).toBe(link2.id);
    });
  });

  describe('getSharedLinks', () => {
    beforeEach(async () => {
      // Add multiple links
      await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: founderId,
        title: 'GitHub',
        url: 'https://github.com/test',
      });

      await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: memberId,
        title: 'Figma',
        url: 'https://figma.com/test',
      });

      await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: founderId,
        title: 'Docs',
        url: 'https://docs.google.com/test',
      });
    });

    it('should return all links for team member', async () => {
      const links = await sharedLinkService.getSharedLinks(spaceId, founderId);

      expect(links).toHaveLength(3);
      expect(links[0].title).toBe('GitHub');
      expect(links[1].title).toBe('Figma');
      expect(links[2].title).toBe('Docs');
    });

    it('should return links in chronological order', async () => {
      const links = await sharedLinkService.getSharedLinks(spaceId, memberId);

      // Verify order by checking timestamps
      expect(links[0].createdAt.getTime()).toBeLessThanOrEqual(links[1].createdAt.getTime());
      expect(links[1].createdAt.getTime()).toBeLessThanOrEqual(links[2].createdAt.getTime());
    });

    it('should include creator information', async () => {
      const links = await sharedLinkService.getSharedLinks(spaceId, founderId);

      expect(links[0].creatorName).toBe('Founder User');
      expect(links[1].creatorName).toBe('Member User');
      expect(links[2].creatorName).toBe('Founder User');
    });

    it('should reject non-team member accessing links', async () => {
      await expect(
        sharedLinkService.getSharedLinks(spaceId, nonMemberId)
      ).rejects.toThrow('Access denied: You are not authorized to view links in this Builder Space');
    });

    it('should reject accessing links from non-existent space', async () => {
      await expect(
        sharedLinkService.getSharedLinks('non-existent-space', founderId)
      ).rejects.toThrow('Builder Space not found');
    });

    it('should return empty array when no links exist', async () => {
      // Create a new space with no links
      const newStartup = await testDb.insert(startups).values({
        founderId,
        name: 'New Startup',
        description: 'A new startup',
        stage: 'Idea',
      }).returning();

      await teamFormationService.createTeamMember(founderId, 'startup', newStartup[0].id, 'founder');

      const newSpace = await builderSpaceService.createBuilderSpace(
        'startup',
        newStartup[0].id,
        'New Space'
      );

      const links = await sharedLinkService.getSharedLinks(newSpace.id, founderId);
      expect(links).toHaveLength(0);
    });
  });

  describe('getSharedLink', () => {
    let linkId: string;

    beforeEach(async () => {
      const link = await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: founderId,
        title: 'Test Link',
        url: 'https://example.com',
        description: 'Test description',
      });
      linkId = link.id;
    });

    it('should return link for team member', async () => {
      const link = await sharedLinkService.getSharedLink(linkId, founderId);

      expect(link).toBeDefined();
      expect(link.id).toBe(linkId);
      expect(link.title).toBe('Test Link');
      expect(link.url).toBe('https://example.com');
      expect(link.description).toBe('Test description');
      expect(link.creatorName).toBe('Founder User');
    });

    it('should allow any team member to view link', async () => {
      const link = await sharedLinkService.getSharedLink(linkId, memberId);

      expect(link).toBeDefined();
      expect(link.id).toBe(linkId);
    });

    it('should reject non-team member accessing link', async () => {
      await expect(
        sharedLinkService.getSharedLink(linkId, nonMemberId)
      ).rejects.toThrow('Access denied: You are not authorized to view this link');
    });

    it('should reject accessing non-existent link', async () => {
      await expect(
        sharedLinkService.getSharedLink('non-existent-link', founderId)
      ).rejects.toThrow('Link not found');
    });
  });

  describe('getLinkCount', () => {
    it('should return correct count of links', async () => {
      // Add multiple links
      await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: founderId,
        title: 'Link 1',
        url: 'https://example.com/1',
      });

      await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: memberId,
        title: 'Link 2',
        url: 'https://example.com/2',
      });

      const count = await sharedLinkService.getLinkCount(spaceId, founderId);
      expect(count).toBe(2);
    });

    it('should return 0 when no links exist', async () => {
      const count = await sharedLinkService.getLinkCount(spaceId, founderId);
      expect(count).toBe(0);
    });

    it('should reject non-team member getting count', async () => {
      await expect(
        sharedLinkService.getLinkCount(spaceId, nonMemberId)
      ).rejects.toThrow('Access denied: You are not authorized to view this Builder Space');
    });

    it('should update count after adding and removing links', async () => {
      const link1 = await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: founderId,
        title: 'Link 1',
        url: 'https://example.com/1',
      });

      await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: founderId,
        title: 'Link 2',
        url: 'https://example.com/2',
      });

      let count = await sharedLinkService.getLinkCount(spaceId, founderId);
      expect(count).toBe(2);

      await sharedLinkService.removeSharedLink(link1.id, founderId);

      count = await sharedLinkService.getLinkCount(spaceId, founderId);
      expect(count).toBe(1);
    });
  });

  describe('URL validation edge cases', () => {
    it('should accept http URLs', async () => {
      const link = await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: founderId,
        title: 'HTTP Link',
        url: 'http://example.com',
      });

      expect(link.url).toBe('http://example.com');
    });

    it('should accept https URLs', async () => {
      const link = await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: founderId,
        title: 'HTTPS Link',
        url: 'https://example.com',
      });

      expect(link.url).toBe('https://example.com');
    });

    it('should accept URLs with paths', async () => {
      const link = await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: founderId,
        title: 'Path Link',
        url: 'https://example.com/path/to/resource',
      });

      expect(link.url).toBe('https://example.com/path/to/resource');
    });

    it('should accept URLs with query parameters', async () => {
      const link = await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: founderId,
        title: 'Query Link',
        url: 'https://example.com?param=value&other=test',
      });

      expect(link.url).toBe('https://example.com?param=value&other=test');
    });

    it('should accept URLs with fragments', async () => {
      const link = await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: founderId,
        title: 'Fragment Link',
        url: 'https://example.com#section',
      });

      expect(link.url).toBe('https://example.com#section');
    });

    it('should accept URLs with ports', async () => {
      const link = await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: founderId,
        title: 'Port Link',
        url: 'https://example.com:8080',
      });

      expect(link.url).toBe('https://example.com:8080');
    });

    it('should accept URLs with subdomains', async () => {
      const link = await sharedLinkService.addSharedLink({
        spaceId,
        creatorId: founderId,
        title: 'Subdomain Link',
        url: 'https://subdomain.example.com',
      });

      expect(link.url).toBe('https://subdomain.example.com');
    });
  });
});
