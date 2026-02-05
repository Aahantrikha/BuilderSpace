import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import request from 'supertest';
import express from 'express';
import screeningChatsRouter from '../routes/screeningChats.js';
import builderSpacesRouter from '../routes/builderSpaces.js';
import { db, users, applications, teamSpaces, teamMembers, startups } from '../db/index.js';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

// Feature: team-collaboration-workspace, Property 13: API Consistency and Security
// **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

describe('Property 13: API Consistency and Security', () => {
  let app: express.Application;
  const testUsers: string[] = [];
  const testApplications: string[] = [];
  const testSpaces: string[] = [];
  const testStartups: string[] = [];

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/screening-chats', screeningChatsRouter);
    app.use('/api/builder-spaces', builderSpacesRouter);
  });

  afterEach(async () => {
    // Clean up test data
    for (const userId of testUsers) {
      await db.delete(users).where(eq(users.id, userId));
      await db.delete(teamMembers).where(eq(teamMembers.userId, userId));
    }
    for (const appId of testApplications) {
      await db.delete(applications).where(eq(applications.id, appId));
    }
    for (const spaceId of testSpaces) {
      await db.delete(teamSpaces).where(eq(teamSpaces.id, spaceId));
    }
    for (const startupId of testStartups) {
      await db.delete(startups).where(eq(startups.id, startupId));
    }
    testUsers.length = 0;
    testApplications.length = 0;
    testSpaces.length = 0;
    testStartups.length = 0;
  });

  /**
   * Helper to create a test user and get auth token
   */
  async function createTestUser(suffix: string): Promise<{ userId: string; token: string }> {
    const userId = `user-${Date.now()}-${suffix}`;
    testUsers.push(userId);

    await db.insert(users).values({
      id: userId,
      email: `${userId}@test.com`,
      name: `Test User ${suffix}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = jwt.sign({ id: userId, email: `${userId}@test.com` }, JWT_SECRET);
    return { userId, token };
  }

  /**
   * Property: All API endpoints should return responses in consistent JSON format
   */
  it('should return consistent JSON format for all API responses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          { method: 'get', path: '/api/screening-chats' },
          { method: 'get', path: '/api/builder-spaces/test-space-id' }
        ),
        async (endpoint) => {
          const { token } = await createTestUser('json-test');

          const response = await request(app)
            [endpoint.method](endpoint.path)
            .set('Authorization', `Bearer ${token}`);

          // All responses should be JSON
          expect(response.headers['content-type']).toMatch(/json/);

          // Response should be parseable JSON
          expect(response.body).toBeDefined();
          expect(typeof response.body).toBe('object');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All API endpoints should require authentication
   */
  it('should require authentication for all protected endpoints', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          { method: 'get', path: '/api/screening-chats' },
          { method: 'post', path: '/api/screening-chats' },
          { method: 'get', path: '/api/builder-spaces/test-id' },
          { method: 'post', path: '/api/builder-spaces/test-id/messages' },
          { method: 'get', path: '/api/builder-spaces/test-id/messages' },
          { method: 'post', path: '/api/builder-spaces/test-id/links' },
          { method: 'get', path: '/api/builder-spaces/test-id/links' },
          { method: 'post', path: '/api/builder-spaces/test-id/tasks' },
          { method: 'get', path: '/api/builder-spaces/test-id/tasks' }
        ),
        async (endpoint) => {
          // Request without authentication
          const response = await request(app)
            [endpoint.method](endpoint.path)
            .send({});

          // Should return 401 Unauthorized
          expect(response.status).toBe(401);
          expect(response.body).toHaveProperty('error');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Invalid authentication tokens should be rejected
   */
  it('should reject invalid authentication tokens', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 50 }),
        fc.constantFrom(
          { method: 'get', path: '/api/screening-chats' },
          { method: 'get', path: '/api/builder-spaces/test-id' }
        ),
        async (invalidToken, endpoint) => {
          const response = await request(app)
            [endpoint.method](endpoint.path)
            .set('Authorization', `Bearer ${invalidToken}`);

          // Should return 401 or 403
          expect([401, 403]).toContain(response.status);
          expect(response.body).toHaveProperty('error');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: API endpoints should validate input data
   */
  it('should validate input data and return appropriate errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          content: fc.oneof(
            fc.constant(''), // Empty string
            fc.constant(null), // Null
            fc.constant(undefined), // Undefined
            fc.integer() // Wrong type
          ),
        }),
        async (invalidData) => {
          const { token } = await createTestUser('validation-test');

          // Try to send message with invalid data
          const response = await request(app)
            .post('/api/builder-spaces/test-space-id/messages')
            .set('Authorization', `Bearer ${token}`)
            .send(invalidData);

          // Should return 400 Bad Request or 403 Forbidden (if space doesn't exist)
          expect([400, 403]).toContain(response.status);
          expect(response.body).toHaveProperty('error');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: API should enforce authorization for resource access
   */
  it('should enforce authorization for resource access', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 }),
        async (resourceId) => {
          const { token } = await createTestUser('auth-test');

          // Try to access a resource that doesn't exist or user doesn't have access to
          const response = await request(app)
            .get(`/api/builder-spaces/${resourceId}`)
            .set('Authorization', `Bearer ${token}`);

          // Should return 403 Forbidden or 404 Not Found
          expect([403, 404]).toContain(response.status);
          expect(response.body).toHaveProperty('error');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Error responses should have consistent structure
   */
  it('should return consistent error response structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          { method: 'get', path: '/api/screening-chats/nonexistent' },
          { method: 'get', path: '/api/builder-spaces/nonexistent' },
          { method: 'post', path: '/api/builder-spaces/test/messages', body: {} }
        ),
        async (endpoint) => {
          const { token } = await createTestUser('error-test');

          const req = request(app)
            [endpoint.method](endpoint.path)
            .set('Authorization', `Bearer ${token}`);

          if (endpoint.body) {
            req.send(endpoint.body);
          }

          const response = await req;

          // Error responses should have error field
          if (response.status >= 400) {
            expect(response.body).toHaveProperty('error');
            expect(typeof response.body.error).toBe('string');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Success responses should have consistent structure
   */
  it('should return consistent success response structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }),
        async (testCase) => {
          const { userId, token } = await createTestUser(`success-${testCase}`);

          // Create test data based on test case
          if (testCase === 1) {
            // Test screening chats list
            const response = await request(app)
              .get('/api/screening-chats')
              .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('screeningChats');
            expect(Array.isArray(response.body.screeningChats)).toBe(true);
          } else if (testCase === 2) {
            // Create a Builder Space and test access
            const timestamp = Date.now();
            const startupId = `startup-${timestamp}`;
            const spaceId = `space-${timestamp}`;

            testStartups.push(startupId);
            testSpaces.push(spaceId);

            await db.insert(startups).values({
              id: startupId,
              userId,
              title: 'Test Startup',
              description: 'Test',
              stage: 'idea',
              lookingFor: ['developer'],
              createdAt: new Date(timestamp),
              updatedAt: new Date(timestamp),
            });

            await db.insert(teamSpaces).values({
              id: spaceId,
              postType: 'startup',
              postId: startupId,
              name: 'Test Space',
              createdAt: new Date(timestamp),
              updatedAt: new Date(timestamp),
            });

            await db.insert(teamMembers).values({
              id: `member-${timestamp}`,
              userId,
              postType: 'startup',
              postId: startupId,
              role: 'founder',
              joinedAt: new Date(timestamp),
              createdAt: new Date(timestamp),
              updatedAt: new Date(timestamp),
            });

            const response = await request(app)
              .get(`/api/builder-spaces/${spaceId}`)
              .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('space');
            expect(response.body.space).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: API should handle concurrent requests safely
   */
  it('should handle concurrent API requests safely', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        async (numRequests) => {
          const { token } = await createTestUser('concurrent-test');

          // Make concurrent requests
          const requests = Array.from({ length: numRequests }, () =>
            request(app)
              .get('/api/screening-chats')
              .set('Authorization', `Bearer ${token}`)
          );

          const responses = await Promise.all(requests);

          // All requests should succeed
          responses.forEach((response) => {
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('screeningChats');
          });

          // All responses should be consistent
          const firstResponse = JSON.stringify(responses[0].body);
          responses.forEach((response) => {
            expect(JSON.stringify(response.body)).toBe(firstResponse);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: API should properly handle malformed JSON
   */
  it('should handle malformed JSON gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (malformedJson) => {
          const { token } = await createTestUser('malformed-test');

          const response = await request(app)
            .post('/api/builder-spaces/test-id/messages')
            .set('Authorization', `Bearer ${token}`)
            .set('Content-Type', 'application/json')
            .send(malformedJson);

          // Should return 400 Bad Request or 403 Forbidden
          expect([400, 403]).toContain(response.status);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: API endpoints should maintain backward compatibility
   */
  it('should maintain backward compatibility with existing endpoints', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          '/api/screening-chats',
          '/api/builder-spaces/test-id'
        ),
        async (endpoint) => {
          const { token } = await createTestUser('compat-test');

          const response = await request(app)
            .get(endpoint)
            .set('Authorization', `Bearer ${token}`);

          // Endpoint should exist (not 404)
          expect(response.status).not.toBe(404);

          // Should return JSON
          expect(response.headers['content-type']).toMatch(/json/);
        }
      ),
      { numRuns: 100 }
    );
  });
});
