import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateSyncService, ConflictResolution } from './StateSyncService.js';
import { MessageBroadcastService } from './MessageBroadcastService.js';
import { db, teamSpaces, spaceMessages, spaceLinks, spaceTasks, teamMembers, users } from '../db/index.js';
import { eq } from 'drizzle-orm';

describe('StateSyncService', () => {
  let service: StateSyncService;
  let broadcastService: MessageBroadcastService;
  let testSpaceId: string;
  let testUserId: string;

  beforeEach(async () => {
    // Create test data
    const timestamp = Date.now();
    testUserId = 'test-user-' + timestamp;
    const postId = 'test-post-' + timestamp;

    // Create test user first (required for foreign keys)
    await db.insert(users).values({
      id: testUserId,
      email: `${testUserId}@test.com`,
      name: 'Test User',
    });

    // Create team space
    const [space] = await db
      .insert(teamSpaces)
      .values({
        id: 'test-space-' + timestamp,
        postType: 'startup',
        postId,
        name: 'Test Space',
        createdAt: new Date(timestamp),
        updatedAt: new Date(timestamp),
      })
      .returning();

    testSpaceId = space.id;

    // Create team member
    await db.insert(teamMembers).values({
      id: 'test-member-' + timestamp,
      userId: testUserId,
      postType: 'startup',
      postId,
      role: 'member',
      joinedAt: new Date(timestamp),
      createdAt: new Date(timestamp),
      updatedAt: new Date(timestamp),
    });

    // Initialize services
    broadcastService = new MessageBroadcastService(db);
    service = new StateSyncService(db, broadcastService);
  });

  afterEach(async () => {
    // Clean up test data
    if (testSpaceId) {
      await db.delete(spaceMessages).where(eq(spaceMessages.spaceId, testSpaceId));
      await db.delete(spaceLinks).where(eq(spaceLinks.spaceId, testSpaceId));
      await db.delete(spaceTasks).where(eq(spaceTasks.spaceId, testSpaceId));
      await db.delete(teamSpaces).where(eq(teamSpaces.id, testSpaceId));
    }
    if (testUserId) {
      await db.delete(teamMembers).where(eq(teamMembers.userId, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  describe('getFullState', () => {
    it('should return complete state snapshot for a Builder Space', async () => {
      // Add test data
      await db.insert(spaceMessages).values({
        id: 'msg-1',
        spaceId: testSpaceId,
        senderId: testUserId,
        content: 'Test message',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(spaceLinks).values({
        id: 'link-1',
        spaceId: testSpaceId,
        creatorId: testUserId,
        title: 'Test Link',
        url: 'https://example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(spaceTasks).values({
        id: 'task-1',
        spaceId: testSpaceId,
        creatorId: testUserId,
        title: 'Test Task',
        completed: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Get full state
      const state = await service.getFullState(testSpaceId);

      expect(state.spaceId).toBe(testSpaceId);
      expect(state.messages).toHaveLength(1);
      expect(state.links).toHaveLength(1);
      expect(state.tasks).toHaveLength(1);
      expect(state.members).toHaveLength(1);
      expect(state.lastUpdated).toBeInstanceOf(Date);
    });

    it('should return empty arrays for space with no data', async () => {
      const state = await service.getFullState(testSpaceId);

      expect(state.spaceId).toBe(testSpaceId);
      expect(state.messages).toHaveLength(0);
      expect(state.links).toHaveLength(0);
      expect(state.tasks).toHaveLength(0);
      expect(state.members).toHaveLength(1); // Still has the test member
    });
  });

  describe('syncUserState', () => {
    it('should synchronize user with latest state', async () => {
      // Add test data
      await db.insert(spaceMessages).values({
        id: 'msg-1',
        spaceId: testSpaceId,
        senderId: testUserId,
        content: 'Test message',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Sync user state (should not throw)
      await expect(
        service.syncUserState(testUserId, testSpaceId)
      ).resolves.not.toThrow();
    });

    it('should reject sync for non-team members', async () => {
      const nonMemberId = 'non-member-' + Date.now();

      await expect(
        service.syncUserState(nonMemberId, testSpaceId)
      ).rejects.toThrow('User is not a team member');
    });
  });

  describe('broadcastUpdate', () => {
    it('should broadcast incremental update and increment version', async () => {
      const initialVersion = service.getStateVersion(testSpaceId);

      await service.broadcastUpdate(
        testSpaceId,
        {
          type: 'message',
          action: 'create',
          data: { content: 'New message' },
          timestamp: new Date(),
        }
      );

      const newVersion = service.getStateVersion(testSpaceId);
      expect(newVersion).toBe(initialVersion + 1);
    });

    it('should handle different update types', async () => {
      const updates = [
        { type: 'message' as const, action: 'create' as const },
        { type: 'link' as const, action: 'create' as const },
        { type: 'task' as const, action: 'update' as const },
        { type: 'member' as const, action: 'create' as const },
      ];

      for (const update of updates) {
        await expect(
          service.broadcastUpdate(testSpaceId, {
            ...update,
            data: {},
            timestamp: new Date(),
          })
        ).resolves.not.toThrow();
      }
    });
  });

  describe('handleConcurrentOperation', () => {
    it('should execute operation successfully', async () => {
      const operation = async () => {
        return 'success';
      };

      const result = await service.handleConcurrentOperation(
        testSpaceId,
        operation
      );

      expect(result).toBe('success');
    });

    it('should increment version on successful operation', async () => {
      const initialVersion = service.getStateVersion(testSpaceId);

      await service.handleConcurrentOperation(
        testSpaceId,
        async () => 'success'
      );

      const newVersion = service.getStateVersion(testSpaceId);
      expect(newVersion).toBe(initialVersion + 1);
    });

    it('should retry on conflict errors', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('SQLITE_CONSTRAINT: conflict');
        }
        return 'success';
      };

      const result = await service.handleConcurrentOperation(
        testSpaceId,
        operation,
        ConflictResolution.LAST_WRITE_WINS
      );

      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should fail after max retries', async () => {
      const operation = async () => {
        throw new Error('SQLITE_CONSTRAINT: conflict');
      };

      await expect(
        service.handleConcurrentOperation(
          testSpaceId,
          operation,
          ConflictResolution.LAST_WRITE_WINS
        )
      ).rejects.toThrow('Concurrent operation failed after 3 attempts');
    });

    it('should rethrow non-conflict errors immediately', async () => {
      const operation = async () => {
        throw new Error('Some other error');
      };

      await expect(
        service.handleConcurrentOperation(testSpaceId, operation)
      ).rejects.toThrow('Some other error');
    });
  });

  describe('state version management', () => {
    it('should track state versions per space', () => {
      const space1 = 'space-1';
      const space2 = 'space-2';

      expect(service.getStateVersion(space1)).toBe(0);
      expect(service.getStateVersion(space2)).toBe(0);

      service.resetStateVersion(space1);
      expect(service.getStateVersion(space1)).toBe(0);
    });
  });
});
