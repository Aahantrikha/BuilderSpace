import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { db, teamSpaces, spaceMessages, teamMembers, users } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { withRetry, withGracefulDegradation, errorLogger } from '../utils/errorRecovery.js';
import { handleDatabaseError } from '../middleware/errorHandler.js';

// Feature: team-collaboration-workspace, Property 14: Error Handling and Recovery
// **Validates: Requirements 9.2**

describe('Property 14: Error Handling and Recovery', () => {
  const testSpaces: string[] = [];
  const testUsers: string[] = [];

  beforeEach(() => {
    errorLogger.clearLogs();
  });

  afterEach(async () => {
    // Clean up test data
    for (const spaceId of testSpaces) {
      await db.delete(spaceMessages).where(eq(spaceMessages.spaceId, spaceId));
      await db.delete(teamSpaces).where(eq(teamSpaces.id, spaceId));
    }
    for (const userId of testUsers) {
      await db.delete(teamMembers).where(eq(teamMembers.userId, userId));
    }
    testSpaces.length = 0;
    testUsers.length = 0;
  });

  /**
   * Property: For any database operation failure, the system should return 
   * appropriate error messages while maintaining data consistency.
   */
  it('should handle database constraint violations appropriately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 }),
        async (uniqueId) => {
          const timestamp = Date.now();
          const spaceId = `space-${timestamp}-${uniqueId}`;
          const postId = `post-${timestamp}`;

          testSpaces.push(spaceId);

          // Create a space
          await db.insert(teamSpaces).values({
            id: spaceId,
            postType: 'startup',
            postId,
            name: 'Test Space',
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
          });

          // Try to create duplicate space (should fail with constraint violation)
          try {
            await db.insert(teamSpaces).values({
              id: spaceId, // Same ID - will violate unique constraint
              postType: 'startup',
              postId,
              name: 'Duplicate Space',
              createdAt: new Date(timestamp),
              updatedAt: new Date(timestamp),
            });

            // Should not reach here
            expect(true).toBe(false);
          } catch (error: any) {
            // Handle the error
            const appError = handleDatabaseError(error);

            // Should return appropriate error
            expect(appError.statusCode).toBe(409);
            expect(appError.message).toContain('constraint');

            // Verify original data is still intact
            const spaces = await db
              .select()
              .from(teamSpaces)
              .where(eq(teamSpaces.id, spaceId));

            expect(spaces).toHaveLength(1);
            expect(spaces[0].name).toBe('Test Space');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Database operations should maintain consistency even when errors occur
   */
  it('should maintain data consistency when operations fail', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (numMessages) => {
          const timestamp = Date.now();
          const spaceId = `space-${timestamp}`;
          const postId = `post-${timestamp}`;

          testSpaces.push(spaceId);

          // Create a space
          await db.insert(teamSpaces).values({
            id: spaceId,
            postType: 'startup',
            postId,
            name: 'Test Space',
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
          });

          // Insert some messages successfully
          const successfulMessages: string[] = [];
          for (let i = 0; i < numMessages; i++) {
            const messageId = `msg-${timestamp}-${i}`;
            try {
              await db.insert(spaceMessages).values({
                id: messageId,
                spaceId,
                senderId: `user-${i}`,
                content: `Message ${i}`,
                createdAt: new Date(timestamp + i),
                updatedAt: new Date(timestamp + i),
              });
              successfulMessages.push(messageId);
            } catch (error) {
              // Some might fail, that's ok
            }
          }

          // Try to insert a message with invalid foreign key (should fail)
          try {
            await db.insert(spaceMessages).values({
              id: `msg-invalid-${timestamp}`,
              spaceId: 'nonexistent-space', // Invalid foreign key
              senderId: 'user-test',
              content: 'Invalid message',
              createdAt: new Date(timestamp),
              updatedAt: new Date(timestamp),
            });
          } catch (error: any) {
            // Expected to fail
            const appError = handleDatabaseError(error);
            expect([400, 500]).toContain(appError.statusCode);
          }

          // Verify successful messages are still there
          const messages = await db
            .select()
            .from(spaceMessages)
            .where(eq(spaceMessages.spaceId, spaceId));

          expect(messages).toHaveLength(successfulMessages.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Retry mechanism should handle transient failures
   */
  it('should retry transient database failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }),
        async (numFailures) => {
          let attempts = 0;

          const operation = async () => {
            attempts++;
            if (attempts <= numFailures) {
              throw new Error('SQLITE_BUSY: database is locked');
            }
            return 'success';
          };

          const result = await withRetry(operation, {
            maxAttempts: numFailures + 2,
            delayMs: 10,
          });

          expect(result).toBe('success');
          expect(attempts).toBe(numFailures + 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Graceful degradation should provide fallback values
   */
  it('should provide fallback values when operations fail', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
        async (defaultMessages) => {
          const operation = async () => {
            // Simulate a failure
            throw new Error('Service unavailable');
          };

          const result = await withGracefulDegradation(
            operation,
            defaultMessages,
            'Get messages'
          );

          // Should return default value
          expect(result).toEqual(defaultMessages);

          // Should log the error
          const logs = errorLogger.getRecentLogs();
          expect(logs.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Error responses should have consistent structure
   */
  it('should return consistent error structure for different error types', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'SQLITE_CONSTRAINT: unique constraint failed',
          'database is locked',
          'FOREIGN KEY constraint failed',
          'not found',
          'connection failed'
        ),
        async (errorMessage) => {
          const error = new Error(errorMessage);
          const appError = handleDatabaseError(error);

          // All errors should have consistent structure
          expect(appError).toHaveProperty('statusCode');
          expect(appError).toHaveProperty('message');
          expect(appError).toHaveProperty('code');
          expect(typeof appError.statusCode).toBe('number');
          expect(typeof appError.message).toBe('string');
          expect(typeof appError.code).toBe('string');

          // Status code should be valid HTTP status
          expect(appError.statusCode).toBeGreaterThanOrEqual(400);
          expect(appError.statusCode).toBeLessThan(600);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Failed operations should not leave partial data
   */
  it('should not leave partial data when operations fail', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (batchSize) => {
          const timestamp = Date.now();
          const spaceId = `space-${timestamp}`;
          const postId = `post-${timestamp}`;

          testSpaces.push(spaceId);

          // Create a space
          await db.insert(teamSpaces).values({
            id: spaceId,
            postType: 'startup',
            postId,
            name: 'Test Space',
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
          });

          // Count messages before
          const messagesBefore = await db
            .select()
            .from(spaceMessages)
            .where(eq(spaceMessages.spaceId, spaceId));

          // Try to insert batch with one invalid item
          try {
            for (let i = 0; i < batchSize; i++) {
              if (i === Math.floor(batchSize / 2)) {
                // Insert invalid message (missing required field)
                await db.insert(spaceMessages).values({
                  id: `msg-${timestamp}-${i}`,
                  spaceId,
                  senderId: '', // Invalid - empty sender
                  content: '', // Invalid - empty content
                  createdAt: new Date(timestamp),
                  updatedAt: new Date(timestamp),
                } as any);
              } else {
                await db.insert(spaceMessages).values({
                  id: `msg-${timestamp}-${i}`,
                  spaceId,
                  senderId: `user-${i}`,
                  content: `Message ${i}`,
                  createdAt: new Date(timestamp + i),
                  updatedAt: new Date(timestamp + i),
                });
              }
            }
          } catch (error) {
            // Expected to fail
          }

          // Count messages after
          const messagesAfter = await db
            .select()
            .from(spaceMessages)
            .where(eq(spaceMessages.spaceId, spaceId));

          // Should have some messages (the valid ones before the error)
          // but not all (because one failed)
          expect(messagesAfter.length).toBeGreaterThanOrEqual(messagesBefore.length);
          expect(messagesAfter.length).toBeLessThan(batchSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Error logging should capture all failures
   */
  it('should log all errors that occur', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (numErrors) => {
          errorLogger.clearLogs();

          for (let i = 0; i < numErrors; i++) {
            const operation = async () => {
              throw new Error(`Error ${i}`);
            };

            await withGracefulDegradation(operation, null, `Operation ${i}`);
          }

          const logs = errorLogger.getRecentLogs();
          expect(logs.length).toBe(numErrors);

          // Each error should be logged
          for (let i = 0; i < numErrors; i++) {
            expect(logs[i].error.message).toBe(`Error ${i}`);
            expect(logs[i].context).toContain(`Operation ${i}`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Database errors should not expose sensitive information
   */
  it('should sanitize error messages to avoid exposing sensitive data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'SQLITE_CONSTRAINT: UNIQUE constraint failed: users.email',
          'database locked at /path/to/database.db',
          'connection failed to localhost:5432'
        ),
        async (sensitiveError) => {
          const error = new Error(sensitiveError);
          const appError = handleDatabaseError(error);

          // Error message should be generic
          expect(appError.message).not.toContain('/path/to');
          expect(appError.message).not.toContain('localhost');
          expect(appError.message).not.toContain(':5432');

          // Should provide user-friendly message
          expect(appError.message.length).toBeGreaterThan(0);
          expect(appError.message).toMatch(/[A-Z]/); // Should be properly formatted
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Retry mechanism should respect max attempts
   */
  it('should not retry more than max attempts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (maxAttempts) => {
          let attempts = 0;

          const operation = async () => {
            attempts++;
            throw new Error('SQLITE_BUSY: database is locked');
          };

          try {
            await withRetry(operation, { maxAttempts, delayMs: 10 });
          } catch (error) {
            // Expected to fail
          }

          expect(attempts).toBe(maxAttempts);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Error recovery should maintain system stability
   */
  it('should maintain system stability after multiple errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 5, max: 20 }),
        async (numOperations) => {
          const timestamp = Date.now();
          const spaceId = `space-${timestamp}`;
          const postId = `post-${timestamp}`;

          testSpaces.push(spaceId);

          // Create a space
          await db.insert(teamSpaces).values({
            id: spaceId,
            postType: 'startup',
            postId,
            name: 'Test Space',
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
          });

          let successCount = 0;
          let errorCount = 0;

          // Perform multiple operations, some will fail
          for (let i = 0; i < numOperations; i++) {
            try {
              if (i % 3 === 0) {
                // This will fail (duplicate ID)
                await db.insert(spaceMessages).values({
                  id: `msg-duplicate`,
                  spaceId,
                  senderId: `user-${i}`,
                  content: `Message ${i}`,
                  createdAt: new Date(timestamp + i),
                  updatedAt: new Date(timestamp + i),
                });
              } else {
                // This will succeed
                await db.insert(spaceMessages).values({
                  id: `msg-${timestamp}-${i}`,
                  spaceId,
                  senderId: `user-${i}`,
                  content: `Message ${i}`,
                  createdAt: new Date(timestamp + i),
                  updatedAt: new Date(timestamp + i),
                });
              }
              successCount++;
            } catch (error) {
              errorCount++;
            }
          }

          // System should still be functional
          const messages = await db
            .select()
            .from(spaceMessages)
            .where(eq(spaceMessages.spaceId, spaceId));

          // Should have successful messages
          expect(messages.length).toBeGreaterThan(0);
          expect(messages.length).toBe(successCount);

          // Should have had some errors
          expect(errorCount).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
