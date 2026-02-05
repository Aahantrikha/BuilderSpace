import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { StateSyncService } from './StateSyncService.js';
import { MessageBroadcastService } from './MessageBroadcastService.js';
import { db, teamSpaces, spaceMessages, spaceLinks, spaceTasks, teamMembers, users } from '../db/index.js';
import { eq, and } from 'drizzle-orm';

// Feature: team-collaboration-workspace, Property 11: Real-time State Synchronization
// **Validates: Requirements 8.4, 8.5**

describe('Property 11: Real-time State Synchronization', () => {
  let service: StateSyncService;
  let broadcastService: MessageBroadcastService;
  const testSpaces: string[] = [];
  const testUsers: string[] = [];
  const testPosts: string[] = [];

  beforeEach(() => {
    broadcastService = new MessageBroadcastService(db);
    service = new StateSyncService(db, broadcastService);
  });

  afterEach(async () => {
    // Clean up test data
    for (const spaceId of testSpaces) {
      await db.delete(spaceMessages).where(eq(spaceMessages.spaceId, spaceId));
      await db.delete(spaceLinks).where(eq(spaceLinks.spaceId, spaceId));
      await db.delete(spaceTasks).where(eq(spaceTasks.spaceId, spaceId));
      await db.delete(teamSpaces).where(eq(teamSpaces.id, spaceId));
    }
    for (const userId of testUsers) {
      await db.delete(teamMembers).where(eq(teamMembers.userId, userId));
    }
    testSpaces.length = 0;
    testUsers.length = 0;
    testPosts.length = 0;
  });

  /**
   * Property: For any team member coming online, their Builder Space view should 
   * synchronize with the latest state including all messages, links, and tasks.
   */
  it('should synchronize users with latest Builder Space state when coming online', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random number of messages, links, and tasks
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 0, max: 10 }),
        async (numMessages, numLinks, numTasks) => {
          // Setup: Create a Builder Space with team member
          const timestamp = Date.now();
          const postId = `post-${timestamp}`;
          const spaceId = `space-${timestamp}`;
          const userId = `user-${timestamp}`;

          testPosts.push(postId);
          testSpaces.push(spaceId);
          testUsers.push(userId);

          // Create user first (required for foreign keys)
          await db.insert(users).values({ 
            id: userId, 
            email: `${userId}@test.com`, 
            name: 'Test User' 
          });

          // Create space
          await db.insert(teamSpaces).values({
            id: spaceId,
            postType: 'startup',
            postId,
            name: 'Test Space',
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
          });

          // Create team member
          await db.insert(teamMembers).values({
            id: `member-${timestamp}`,
            userId,
            postType: 'startup',
            postId,
            role: 'member',
            joinedAt: new Date(timestamp),
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
          });

          // Add messages
          for (let i = 0; i < numMessages; i++) {
            await db.insert(spaceMessages).values({
              id: `msg-${timestamp}-${i}`,
              spaceId,
              senderId: userId,
              content: `Message ${i}`,
              createdAt: new Date(timestamp + i),
              updatedAt: new Date(timestamp + i),
            });
          }

          // Add links
          for (let i = 0; i < numLinks; i++) {
            await db.insert(spaceLinks).values({
              id: `link-${timestamp}-${i}`,
              spaceId,
              creatorId: userId,
              title: `Link ${i}`,
              url: `https://example.com/${i}`,
              createdAt: new Date(timestamp + i),
              updatedAt: new Date(timestamp + i),
            });
          }

          // Add tasks
          for (let i = 0; i < numTasks; i++) {
            await db.insert(spaceTasks).values({
              id: `task-${timestamp}-${i}`,
              spaceId,
              creatorId: userId,
              title: `Task ${i}`,
              completed: i % 2 === 0 ? 1 : 0,
              createdAt: new Date(timestamp + i),
              updatedAt: new Date(timestamp + i),
            });
          }

          // Action: User comes online and syncs state
          await service.syncUserState(userId, spaceId);

          // Verification: Get full state and verify it matches what was created
          const state = await service.getFullState(spaceId);

          // Assert: State includes all created items
          expect(state.spaceId).toBe(spaceId);
          expect(state.messages).toHaveLength(numMessages);
          expect(state.links).toHaveLength(numLinks);
          expect(state.tasks).toHaveLength(numTasks);
          expect(state.members).toHaveLength(1);
          expect(state.lastUpdated).toBeInstanceOf(Date);

          // Verify message content
          if (numMessages > 0) {
            const messageContents = state.messages.map((m: any) => m.content);
            for (let i = 0; i < numMessages; i++) {
              expect(messageContents).toContain(`Message ${i}`);
            }
          }

          // Verify link URLs
          if (numLinks > 0) {
            const linkUrls = state.links.map((l: any) => l.url);
            for (let i = 0; i < numLinks; i++) {
              expect(linkUrls).toContain(`https://example.com/${i}`);
            }
          }

          // Verify task titles
          if (numTasks > 0) {
            const taskTitles = state.tasks.map((t: any) => t.title);
            for (let i = 0; i < numTasks; i++) {
              expect(taskTitles).toContain(`Task ${i}`);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: State synchronization should work correctly regardless of the order
   * in which items were created
   */
  it('should synchronize state correctly regardless of creation order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constantFrom('message', 'link', 'task'),
            content: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (items) => {
          // Setup: Create a Builder Space
          const timestamp = Date.now();
          const postId = `post-${timestamp}`;
          const spaceId = `space-${timestamp}`;
          const userId = `user-${timestamp}`;

          testPosts.push(postId);
          testSpaces.push(spaceId);
          testUsers.push(userId);


          // Create user first (required for foreign keys)
          await db.insert(users).values({ 
            id: userId, 
            email: `@test.com`, 
            name: 'Test User' 
          });
          await db.insert(teamSpaces).values({
            id: spaceId,
            postType: 'startup',
            postId,
            name: 'Test Space',
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
          });

          await db.insert(teamMembers).values({
            id: `member-${timestamp}`,
            userId,
            postType: 'startup',
            postId,
            role: 'member',
            joinedAt: new Date(timestamp),
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
          });

          // Add items in the given order
          let messageCount = 0;
          let linkCount = 0;
          let taskCount = 0;

          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const itemTimestamp = timestamp + i;

            switch (item.type) {
              case 'message':
                await db.insert(spaceMessages).values({
                  id: `msg-${timestamp}-${messageCount}`,
                  spaceId,
                  senderId: userId,
                  content: item.content,
                  createdAt: itemTimestamp,
                  updatedAt: itemTimestamp,
                });
                messageCount++;
                break;

              case 'link':
                await db.insert(spaceLinks).values({
                  id: `link-${timestamp}-${linkCount}`,
                  spaceId,
                  creatorId: userId,
                  title: item.content,
                  url: `https://example.com/${linkCount}`,
                  createdAt: itemTimestamp,
                  updatedAt: itemTimestamp,
                });
                linkCount++;
                break;

              case 'task':
                await db.insert(spaceTasks).values({
                  id: `task-${timestamp}-${taskCount}`,
                  spaceId,
                  creatorId: userId,
                  title: item.content,
                  completed: 0,
                  createdAt: itemTimestamp,
                  updatedAt: itemTimestamp,
                });
                taskCount++;
                break;
            }
          }

          // Action: Sync user state
          await service.syncUserState(userId, spaceId);

          // Verification: Get full state
          const state = await service.getFullState(spaceId);

          // Assert: All items are present
          expect(state.messages).toHaveLength(messageCount);
          expect(state.links).toHaveLength(linkCount);
          expect(state.tasks).toHaveLength(taskCount);
          expect(state.spaceId).toBe(spaceId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Non-team members should not be able to sync state
   */
  it('should reject state sync for non-team members', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }),
        async (nonMemberSuffix) => {
          // Setup: Create a Builder Space with one team member
          const timestamp = Date.now();
          const postId = `post-${timestamp}`;
          const spaceId = `space-${timestamp}`;
          const memberId = `member-${timestamp}`;
          const nonMemberId = `non-member-${timestamp}-${nonMemberSuffix}`;

          testPosts.push(postId);
          testSpaces.push(spaceId);
          testUsers.push(memberId);
          testUsers.push(nonMemberId);

          await db.insert(teamSpaces).values({
            id: spaceId,
            postType: 'startup',
            postId,
            name: 'Test Space',
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
          });

          await db.insert(teamMembers).values({
            id: `tm-${timestamp}`,
            userId: memberId,
            postType: 'startup',
            postId,
            role: 'member',
            joinedAt: new Date(timestamp),
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
          });

          // Action & Assert: Non-member should not be able to sync
          await expect(
            service.syncUserState(nonMemberId, spaceId)
          ).rejects.toThrow('User is not a team member');

          // Member should be able to sync
          await expect(
            service.syncUserState(memberId, spaceId)
          ).resolves.not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: State synchronization should include the most recent updates
   */
  it('should include most recent updates in synchronized state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (numUpdates) => {
          // Setup: Create a Builder Space
          const timestamp = Date.now();
          const postId = `post-${timestamp}`;
          const spaceId = `space-${timestamp}`;
          const userId = `user-${timestamp}`;

          testPosts.push(postId);
          testSpaces.push(spaceId);
          testUsers.push(userId);


          // Create user first (required for foreign keys)
          await db.insert(users).values({ 
            id: userId, 
            email: `@test.com`, 
            name: 'Test User' 
          });
          await db.insert(teamSpaces).values({
            id: spaceId,
            postType: 'startup',
            postId,
            name: 'Test Space',
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
          });

          await db.insert(teamMembers).values({
            id: `member-${timestamp}`,
            userId,
            postType: 'startup',
            postId,
            role: 'member',
            joinedAt: new Date(timestamp),
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
          });

          // Create a task and update it multiple times
          const taskId = `task-${timestamp}`;
          await db.insert(spaceTasks).values({
            id: taskId,
            spaceId,
            creatorId: userId,
            title: 'Initial Title',
            completed: 0,
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
          });

          // Perform updates
          for (let i = 0; i < numUpdates; i++) {
            await db
              .update(spaceTasks)
              .set({
                title: `Updated Title ${i}`,
                updatedAt: new Date(timestamp + i) + 1,
              })
              .where(eq(spaceTasks.id, taskId));
          }

          // Action: Sync user state
          await service.syncUserState(userId, spaceId);

          // Verification: Get full state
          const state = await service.getFullState(spaceId);

          // Assert: State includes the most recent update
          expect(state.tasks).toHaveLength(1);
          expect(state.tasks[0].title).toBe(`Updated Title ${numUpdates - 1}`);
        }
      ),
      { numRuns: 100 }
    );
  });
});
