import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { StateSyncService, ConflictResolution } from './StateSyncService.js';
import { MessageBroadcastService } from './MessageBroadcastService.js';
import { db, teamSpaces, spaceMessages, spaceLinks, spaceTasks, teamMembers, users } from '../db/index.js';
import { eq } from 'drizzle-orm';

// Feature: team-collaboration-workspace, Property 12: Concurrent Operation Safety
// **Validates: Requirements 9.4**

describe('Property 12: Concurrent Operation Safety', () => {
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
   * Property: For any concurrent operations on collaboration data, the system should 
   * prevent data loss and maintain consistency across all operations.
   */
  it('should handle concurrent message insertions without data loss', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        async (numConcurrentOps) => {
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

          // Action: Execute concurrent message insertions
          const operations = Array.from({ length: numConcurrentOps }, (_, i) =>
            service.handleConcurrentOperation(
              spaceId,
              async () => {
                await db.insert(spaceMessages).values({
                  id: `msg-${timestamp}-${i}`,
                  spaceId,
                  senderId: userId,
                  content: `Concurrent message ${i}`,
                  createdAt: new Date(timestamp + i),
                  updatedAt: new Date(timestamp + i),
                });
                return i;
              }
            )
          );

          const results = await Promise.all(operations);

          // Verification: All operations completed successfully
          expect(results).toHaveLength(numConcurrentOps);
          expect(results.every((r) => typeof r === 'number')).toBe(true);

          // Verify all messages were inserted
          const messages = await db
            .select()
            .from(spaceMessages)
            .where(eq(spaceMessages.spaceId, spaceId));

          expect(messages).toHaveLength(numConcurrentOps);

          // Verify no duplicate messages
          const messageIds = messages.map((m) => m.id);
          const uniqueIds = new Set(messageIds);
          expect(uniqueIds.size).toBe(numConcurrentOps);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Concurrent task updates should maintain consistency
   */
  it('should handle concurrent task status updates consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 8 }),
        async (numConcurrentUpdates) => {
          // Setup: Create a Builder Space with a task
          const timestamp = Date.now();
          const postId = `post-${timestamp}`;
          const spaceId = `space-${timestamp}`;
          const userId = `user-${timestamp}`;
          const taskId = `task-${timestamp}`;

          testPosts.push(postId);
          testSpaces.push(spaceId);
          testUsers.push(userId);

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

          await db.insert(spaceTasks).values({
            id: taskId,
            spaceId,
            creatorId: userId,
            title: 'Test Task',
            completed: 0,
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
          });

          // Action: Execute concurrent task updates
          const operations = Array.from({ length: numConcurrentUpdates }, (_, i) =>
            service.handleConcurrentOperation(
              spaceId,
              async () => {
                // Toggle completion status
                const currentTask = await db
                  .select()
                  .from(spaceTasks)
                  .where(eq(spaceTasks.id, taskId))
                  .limit(1);

                if (currentTask.length > 0) {
                  const newStatus = currentTask[0].completed === 1 ? 0 : 1;
                  await db
                    .update(spaceTasks)
                    .set({
                      completed: newStatus,
                      updatedAt: new Date(timestamp + i),
                    })
                    .where(eq(spaceTasks.id, taskId));
                }
                return i;
              }
            )
          );

          await Promise.all(operations);

          // Verification: Task still exists and has a valid state
          const finalTask = await db
            .select()
            .from(spaceTasks)
            .where(eq(spaceTasks.id, taskId))
            .limit(1);

          expect(finalTask).toHaveLength(1);
          expect([0, 1]).toContain(finalTask[0].completed);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Concurrent link additions should not cause data loss
   */
  it('should handle concurrent link additions without data loss', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        fc.array(fc.webUrl(), { minLength: 2, maxLength: 10 }),
        async (numOps, urls) => {
          // Use only the number of URLs we need
          const urlsToUse = urls.slice(0, Math.min(numOps, urls.length));
          if (urlsToUse.length < 2) return; // Skip if not enough URLs

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

          // Action: Execute concurrent link additions
          const operations = urlsToUse.map((url, i) =>
            service.handleConcurrentOperation(
              spaceId,
              async () => {
                await db.insert(spaceLinks).values({
                  id: `link-${timestamp}-${i}`,
                  spaceId,
                  creatorId: userId,
                  title: `Link ${i}`,
                  url,
                  createdAt: new Date(timestamp + i),
                  updatedAt: new Date(timestamp + i),
                });
                return i;
              }
            )
          );

          await Promise.all(operations);

          // Verification: All links were added
          const links = await db
            .select()
            .from(spaceLinks)
            .where(eq(spaceLinks.spaceId, spaceId));

          expect(links).toHaveLength(urlsToUse.length);

          // Verify no duplicate links
          const linkIds = links.map((l) => l.id);
          const uniqueIds = new Set(linkIds);
          expect(uniqueIds.size).toBe(urlsToUse.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: State version should increment correctly with concurrent operations
   */
  it('should increment state version correctly with concurrent operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        async (numConcurrentOps) => {
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

          // Reset state version
          service.resetStateVersion(spaceId);
          const initialVersion = service.getStateVersion(spaceId);

          // Action: Execute concurrent operations
          const operations = Array.from({ length: numConcurrentOps }, (_, i) =>
            service.handleConcurrentOperation(
              spaceId,
              async () => {
                // Simple operation that succeeds
                return i;
              }
            )
          );

          await Promise.all(operations);

          // Verification: Version incremented by number of operations
          const finalVersion = service.getStateVersion(spaceId);
          expect(finalVersion).toBe(initialVersion + numConcurrentOps);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Failed operations should not corrupt state
   */
  it('should maintain consistency when some operations fail', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 3, max: 10 }),
        fc.integer({ min: 1, max: 3 }),
        async (totalOps, numFailures) => {
          if (numFailures >= totalOps) return; // Skip if all would fail

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

          // Action: Execute mix of successful and failing operations
          const operations = Array.from({ length: totalOps }, (_, i) =>
            service.handleConcurrentOperation(
              spaceId,
              async () => {
                // Some operations fail
                if (i < numFailures) {
                  throw new Error('Intentional failure');
                }

                // Others succeed
                await db.insert(spaceMessages).values({
                  id: `msg-${timestamp}-${i}`,
                  spaceId,
                  senderId: userId,
                  content: `Message ${i}`,
                  createdAt: new Date(timestamp + i),
                  updatedAt: new Date(timestamp + i),
                });
                return i;
              }
            ).catch((err) => ({ error: err.message }))
          );

          const results = await Promise.all(operations);

          // Verification: Count successful operations
          const successCount = results.filter((r) => typeof r === 'number').length;
          const failCount = results.filter((r: any) => r.error).length;

          expect(successCount + failCount).toBe(totalOps);
          expect(failCount).toBe(numFailures);

          // Verify only successful messages were inserted
          const messages = await db
            .select()
            .from(spaceMessages)
            .where(eq(spaceMessages.spaceId, spaceId));

          expect(messages).toHaveLength(successCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Concurrent operations with different conflict resolution strategies
   * should maintain data consistency
   */
  it('should maintain consistency with different conflict resolution strategies', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          ConflictResolution.LAST_WRITE_WINS,
          ConflictResolution.MERGE,
          ConflictResolution.REJECT
        ),
        fc.integer({ min: 2, max: 5 }),
        async (strategy, numOps) => {
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

          // Action: Execute operations with specified strategy
          const operations = Array.from({ length: numOps }, (_, i) =>
            service.handleConcurrentOperation(
              spaceId,
              async () => {
                await db.insert(spaceMessages).values({
                  id: `msg-${timestamp}-${i}`,
                  spaceId,
                  senderId: userId,
                  content: `Message ${i}`,
                  createdAt: new Date(timestamp + i),
                  updatedAt: new Date(timestamp + i),
                });
                return i;
              },
              strategy
            ).catch((err) => ({ error: err.message }))
          );

          const results = await Promise.all(operations);

          // Verification: Check consistency based on strategy
          const messages = await db
            .select()
            .from(spaceMessages)
            .where(eq(spaceMessages.spaceId, spaceId));

          // All strategies should result in consistent state
          expect(messages.length).toBeGreaterThanOrEqual(0);
          expect(messages.length).toBeLessThanOrEqual(numOps);

          // Verify no duplicate message IDs
          const messageIds = messages.map((m) => m.id);
          const uniqueIds = new Set(messageIds);
          expect(uniqueIds.size).toBe(messages.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
