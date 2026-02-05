import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { TeamFormationService } from './TeamFormationService.js';
import { BuilderSpaceService } from './BuilderSpaceService.js';
import { 
  users, 
  startups, 
  hackathons, 
  applications,
  teamMembers,
  teamSpaces
} from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

// Feature: team-collaboration-workspace, Property 4: Team Formation and Builder Space Creation
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 4.1, 4.4, 4.5**

describe('Team Formation and Builder Space Creation - Property Tests', () => {
  let db: BetterSQLite3Database<any>;
  let sqlite: Database.Database;
  let teamFormationService: TeamFormationService;
  let builderSpaceService: BuilderSpaceService;

  beforeEach(() => {
    // Create in-memory database
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite);
    
    teamFormationService = new TeamFormationService(db);
    builderSpaceService = new BuilderSpaceService(db);

    // Create all tables
    sqlite.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password TEXT,
        avatar TEXT,
        college TEXT,
        city TEXT,
        bio TEXT,
        skills TEXT DEFAULT '[]',
        preferences TEXT DEFAULT '{"joinStartup":false,"buildStartup":false,"joinHackathons":false}',
        google_id TEXT,
        email_verified INTEGER DEFAULT 0,
        onboarding_completed INTEGER DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE startups (
        id TEXT PRIMARY KEY,
        founder_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        stage TEXT NOT NULL,
        skills_needed TEXT DEFAULT '[]',
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (founder_id) REFERENCES users(id)
      );

      CREATE TABLE hackathons (
        id TEXT PRIMARY KEY,
        creator_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        team_size INTEGER NOT NULL,
        deadline INTEGER NOT NULL,
        skills_needed TEXT DEFAULT '[]',
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (creator_id) REFERENCES users(id)
      );

      CREATE TABLE applications (
        id TEXT PRIMARY KEY,
        applicant_id TEXT NOT NULL,
        post_type TEXT NOT NULL,
        post_id TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (applicant_id) REFERENCES users(id)
      );

      CREATE TABLE team_members (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        post_type TEXT NOT NULL,
        post_id TEXT NOT NULL,
        role TEXT DEFAULT 'member',
        joined_at INTEGER,
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE team_spaces (
        id TEXT PRIMARY KEY,
        post_type TEXT NOT NULL,
        post_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER,
        updated_at INTEGER
      );
    `);
  });

  afterEach(() => {
    sqlite.close();
  });

  // Custom arbitraries for generating test data
  const userArbitrary = fc.record({
    id: fc.uuid(),
    email: fc.emailAddress().map(email => `${crypto.randomUUID()}_${email}`),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    password: fc.string({ minLength: 6, maxLength: 100 }),
  });

  const postTypeArbitrary = fc.constantFrom('startup', 'hackathon');

  const startupArbitrary = (founderId: string) => fc.record({
    id: fc.uuid(),
    founderId: fc.constant(founderId),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.string({ minLength: 10, maxLength: 500 }),
    stage: fc.constantFrom('Idea', 'Prototype', 'Launched'),
  });

  const hackathonArbitrary = (creatorId: string) => fc.record({
    id: fc.uuid(),
    creatorId: fc.constant(creatorId),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.string({ minLength: 10, maxLength: 500 }),
    teamSize: fc.integer({ min: 1, max: 20 }),
    deadline: fc.integer({ min: Date.now(), max: Date.now() + 365 * 24 * 60 * 60 * 1000 }).map(ts => new Date(ts)),
  });

  const applicationArbitrary = (applicantId: string, postType: string, postId: string) => 
    fc.record({
      id: fc.uuid(),
      applicantId: fc.constant(applicantId),
      postType: fc.constant(postType),
      postId: fc.constant(postId),
      message: fc.string({ minLength: 1, maxLength: 500 }),
    });

  describe('Property 4: Team Formation and Builder Space Creation', () => {
    it('should create exactly one team membership record when inviting to Builder Space', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          async (founder, applicant, postType) => {
            try {
              // Ensure unique IDs and emails
              if (founder.id === applicant.id) {
                applicant.id = crypto.randomUUID();
              }
              if (founder.email === applicant.email) {
                applicant.email = 'alt_' + applicant.email;
              }

              const now = new Date();

              // Insert users
              await db.insert(users).values([
                { ...founder, createdAt: now, updatedAt: now },
                { ...applicant, createdAt: now, updatedAt: now },
              ]);

              // Create post (startup or hackathon)
              let postId: string;
              let postName: string;
              if (postType === 'startup') {
                const startup = fc.sample(startupArbitrary(founder.id), 1)[0];
                await db.insert(startups).values({
                  ...startup,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = startup.id;
                postName = startup.name;
              } else {
                const hackathon = fc.sample(hackathonArbitrary(founder.id), 1)[0];
                await db.insert(hackathons).values({
                  ...hackathon,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = hackathon.id;
                postName = hackathon.name;
              }

              // Create accepted application
              const application = fc.sample(
                applicationArbitrary(applicant.id, postType, postId),
                1
              )[0];
              await db.insert(applications).values({
                ...application,
                status: 'accepted',
                createdAt: now,
                updatedAt: now,
              });

              // Invite to Builder Space (team formation)
              const result = await teamFormationService.inviteToBuilderSpace(
                application.id,
                founder.id
              );

              // Verify exactly one team membership record was created
              expect(result.teamMember).toBeDefined();
              expect(result.teamMember.userId).toBe(applicant.id);
              expect(result.teamMember.postType).toBe(postType);
              expect(result.teamMember.postId).toBe(postId);
              expect(result.teamMember.role).toBe('member');

              // Verify in database - should be exactly one membership for this user/post
              const memberships = await db
                .select()
                .from(teamMembers)
                .where(
                  and(
                    eq(teamMembers.userId, applicant.id),
                    eq(teamMembers.postType, postType),
                    eq(teamMembers.postId, postId)
                  )
                );

              expect(memberships).toHaveLength(1);
              expect(memberships[0].id).toBe(result.teamMember.id);
            } finally {
              // Clean up for next iteration
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM team_members');
              sqlite.exec('DELETE FROM team_spaces');
              sqlite.exec('DELETE FROM applications');
              sqlite.exec('DELETE FROM startups');
              sqlite.exec('DELETE FROM hackathons');
              sqlite.exec('DELETE FROM users');
              sqlite.exec('PRAGMA foreign_keys = ON');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure team has exactly one Builder Space after team formation', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          async (founder, applicant, postType) => {
            try {
              // Ensure unique IDs and emails
              if (founder.id === applicant.id) {
                applicant.id = crypto.randomUUID();
              }
              if (founder.email === applicant.email) {
                applicant.email = 'alt_' + applicant.email;
              }

              const now = new Date();

              // Insert users
              await db.insert(users).values([
                { ...founder, createdAt: now, updatedAt: now },
                { ...applicant, createdAt: now, updatedAt: now },
              ]);

              // Create post
              let postId: string;
              let postName: string;
              if (postType === 'startup') {
                const startup = fc.sample(startupArbitrary(founder.id), 1)[0];
                await db.insert(startups).values({
                  ...startup,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = startup.id;
                postName = startup.name;
              } else {
                const hackathon = fc.sample(hackathonArbitrary(founder.id), 1)[0];
                await db.insert(hackathons).values({
                  ...hackathon,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = hackathon.id;
                postName = hackathon.name;
              }

              // Create accepted application
              const application = fc.sample(
                applicationArbitrary(applicant.id, postType, postId),
                1
              )[0];
              await db.insert(applications).values({
                ...application,
                status: 'accepted',
                createdAt: now,
                updatedAt: now,
              });

              // Invite to Builder Space
              const result = await teamFormationService.inviteToBuilderSpace(
                application.id,
                founder.id
              );

              // Verify Builder Space was created or exists
              expect(result.builderSpace).toBeDefined();
              expect(result.builderSpace.postType).toBe(postType);
              expect(result.builderSpace.postId).toBe(postId);
              expect(result.builderSpace.name).toContain(postName);

              // Verify exactly one Builder Space exists for this team in database
              const spaces = await db
                .select()
                .from(teamSpaces)
                .where(
                  and(
                    eq(teamSpaces.postType, postType),
                    eq(teamSpaces.postId, postId)
                  )
                );

              expect(spaces).toHaveLength(1);
              expect(spaces[0].id).toBe(result.builderSpace.id);

              // Verify uniqueness validation works
              const isUnique = await builderSpaceService.validateBuilderSpaceUniqueness(
                postType as 'startup' | 'hackathon',
                postId
              );
              expect(isUnique).toBe(false); // Should be false since space exists
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM team_members');
              sqlite.exec('DELETE FROM team_spaces');
              sqlite.exec('DELETE FROM applications');
              sqlite.exec('DELETE FROM startups');
              sqlite.exec('DELETE FROM hackathons');
              sqlite.exec('DELETE FROM users');
              sqlite.exec('PRAGMA foreign_keys = ON');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should grant Builder Space access only to official team members', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          async (founder, applicant, nonMember, postType) => {
            try {
              // Ensure unique IDs and emails
              const users_list = [founder, applicant, nonMember];
              for (let i = 0; i < users_list.length; i++) {
                for (let j = i + 1; j < users_list.length; j++) {
                  if (users_list[i].id === users_list[j].id) {
                    users_list[j].id = crypto.randomUUID();
                  }
                  if (users_list[i].email === users_list[j].email) {
                    users_list[j].email = `user${j}_${users_list[j].email}`;
                  }
                }
              }

              const now = new Date();

              // Insert users
              await db.insert(users).values([
                { ...founder, createdAt: now, updatedAt: now },
                { ...applicant, createdAt: now, updatedAt: now },
                { ...nonMember, createdAt: now, updatedAt: now },
              ]);

              // Create post
              let postId: string;
              if (postType === 'startup') {
                const startup = fc.sample(startupArbitrary(founder.id), 1)[0];
                await db.insert(startups).values({
                  ...startup,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = startup.id;
              } else {
                const hackathon = fc.sample(hackathonArbitrary(founder.id), 1)[0];
                await db.insert(hackathons).values({
                  ...hackathon,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = hackathon.id;
              }

              // Create accepted application
              const application = fc.sample(
                applicationArbitrary(applicant.id, postType, postId),
                1
              )[0];
              await db.insert(applications).values({
                ...application,
                status: 'accepted',
                createdAt: now,
                updatedAt: now,
              });

              // Invite to Builder Space
              const result = await teamFormationService.inviteToBuilderSpace(
                application.id,
                founder.id
              );

              const spaceId = result.builderSpace.id;

              // Verify team member (applicant) has access
              const memberHasAccess = await teamFormationService.validateBuilderSpaceAccess(
                applicant.id,
                spaceId
              );
              expect(memberHasAccess).toBe(true);

              // Verify non-member does NOT have access
              const nonMemberHasAccess = await teamFormationService.validateBuilderSpaceAccess(
                nonMember.id,
                spaceId
              );
              expect(nonMemberHasAccess).toBe(false);

              // Verify getBuilderSpace throws error for non-member
              let errorThrown = false;
              try {
                await builderSpaceService.getBuilderSpace(spaceId, nonMember.id);
              } catch (error: any) {
                errorThrown = true;
                expect(error.message).toContain('Access denied');
              }
              expect(errorThrown).toBe(true);

              // Verify getBuilderSpace succeeds for team member
              const space = await builderSpaceService.getBuilderSpace(spaceId, applicant.id);
              expect(space).toBeDefined();
              expect(space.id).toBe(spaceId);
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM team_members');
              sqlite.exec('DELETE FROM team_spaces');
              sqlite.exec('DELETE FROM applications');
              sqlite.exec('DELETE FROM startups');
              sqlite.exec('DELETE FROM hackathons');
              sqlite.exec('DELETE FROM users');
              sqlite.exec('PRAGMA foreign_keys = ON');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain separate Builder Spaces for each team', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          userArbitrary,
          async (founder1, founder2, applicant) => {
            try {
              // Ensure unique IDs and emails
              const users_list = [founder1, founder2, applicant];
              for (let i = 0; i < users_list.length; i++) {
                for (let j = i + 1; j < users_list.length; j++) {
                  if (users_list[i].id === users_list[j].id) {
                    users_list[j].id = crypto.randomUUID();
                  }
                  if (users_list[i].email === users_list[j].email) {
                    users_list[j].email = `user${j}_${users_list[j].email}`;
                  }
                }
              }

              const now = new Date();

              // Insert users
              await db.insert(users).values([
                { ...founder1, createdAt: now, updatedAt: now },
                { ...founder2, createdAt: now, updatedAt: now },
                { ...applicant, createdAt: now, updatedAt: now },
              ]);

              // Create two different startups
              const startup1 = fc.sample(startupArbitrary(founder1.id), 1)[0];
              await db.insert(startups).values({
                ...startup1,
                createdAt: now,
                updatedAt: now,
              });

              const startup2 = fc.sample(startupArbitrary(founder2.id), 1)[0];
              await db.insert(startups).values({
                ...startup2,
                createdAt: now,
                updatedAt: now,
              });

              // Create accepted applications for both startups
              const app1 = fc.sample(
                applicationArbitrary(applicant.id, 'startup', startup1.id),
                1
              )[0];
              await db.insert(applications).values({
                ...app1,
                status: 'accepted',
                createdAt: now,
                updatedAt: now,
              });

              const app2 = fc.sample(
                applicationArbitrary(applicant.id, 'startup', startup2.id),
                1
              )[0];
              await db.insert(applications).values({
                ...app2,
                status: 'accepted',
                createdAt: now,
                updatedAt: now,
              });

              // Invite to both Builder Spaces
              const result1 = await teamFormationService.inviteToBuilderSpace(app1.id, founder1.id);
              const result2 = await teamFormationService.inviteToBuilderSpace(app2.id, founder2.id);

              // Verify two separate Builder Spaces were created
              expect(result1.builderSpace.id).not.toBe(result2.builderSpace.id);
              expect(result1.builderSpace.postId).toBe(startup1.id);
              expect(result2.builderSpace.postId).toBe(startup2.id);

              // Verify each team has exactly one Builder Space
              const spaces1 = await db
                .select()
                .from(teamSpaces)
                .where(
                  and(
                    eq(teamSpaces.postType, 'startup'),
                    eq(teamSpaces.postId, startup1.id)
                  )
                );
              expect(spaces1).toHaveLength(1);

              const spaces2 = await db
                .select()
                .from(teamSpaces)
                .where(
                  and(
                    eq(teamSpaces.postType, 'startup'),
                    eq(teamSpaces.postId, startup2.id)
                  )
                );
              expect(spaces2).toHaveLength(1);

              // Verify applicant has access to both spaces (member of both teams)
              const hasAccess1 = await teamFormationService.validateBuilderSpaceAccess(
                applicant.id,
                result1.builderSpace.id
              );
              expect(hasAccess1).toBe(true);

              const hasAccess2 = await teamFormationService.validateBuilderSpaceAccess(
                applicant.id,
                result2.builderSpace.id
              );
              expect(hasAccess2).toBe(true);
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM team_members');
              sqlite.exec('DELETE FROM team_spaces');
              sqlite.exec('DELETE FROM applications');
              sqlite.exec('DELETE FROM startups');
              sqlite.exec('DELETE FROM hackathons');
              sqlite.exec('DELETE FROM users');
              sqlite.exec('PRAGMA foreign_keys = ON');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure team members can only access Builder Spaces for teams they belong to', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          async (founder1, founder2, member1, member2, postType) => {
            try {
              // Ensure unique IDs and emails
              const users_list = [founder1, founder2, member1, member2];
              for (let i = 0; i < users_list.length; i++) {
                for (let j = i + 1; j < users_list.length; j++) {
                  if (users_list[i].id === users_list[j].id) {
                    users_list[j].id = crypto.randomUUID();
                  }
                  if (users_list[i].email === users_list[j].email) {
                    users_list[j].email = `user${j}_${users_list[j].email}`;
                  }
                }
              }

              const now = new Date();

              // Insert users
              await db.insert(users).values(
                users_list.map(user => ({ ...user, createdAt: now, updatedAt: now }))
              );

              // Create two different posts
              let post1Id: string;
              let post2Id: string;

              if (postType === 'startup') {
                const startup1 = fc.sample(startupArbitrary(founder1.id), 1)[0];
                await db.insert(startups).values({
                  ...startup1,
                  createdAt: now,
                  updatedAt: now,
                });
                post1Id = startup1.id;

                const startup2 = fc.sample(startupArbitrary(founder2.id), 1)[0];
                await db.insert(startups).values({
                  ...startup2,
                  createdAt: now,
                  updatedAt: now,
                });
                post2Id = startup2.id;
              } else {
                const hackathon1 = fc.sample(hackathonArbitrary(founder1.id), 1)[0];
                await db.insert(hackathons).values({
                  ...hackathon1,
                  createdAt: now,
                  updatedAt: now,
                });
                post1Id = hackathon1.id;

                const hackathon2 = fc.sample(hackathonArbitrary(founder2.id), 1)[0];
                await db.insert(hackathons).values({
                  ...hackathon2,
                  createdAt: now,
                  updatedAt: now,
                });
                post2Id = hackathon2.id;
              }

              // Create applications and invite members to different teams
              const app1 = fc.sample(
                applicationArbitrary(member1.id, postType, post1Id),
                1
              )[0];
              await db.insert(applications).values({
                ...app1,
                status: 'accepted',
                createdAt: now,
                updatedAt: now,
              });

              const app2 = fc.sample(
                applicationArbitrary(member2.id, postType, post2Id),
                1
              )[0];
              await db.insert(applications).values({
                ...app2,
                status: 'accepted',
                createdAt: now,
                updatedAt: now,
              });

              // Invite members to their respective teams
              const result1 = await teamFormationService.inviteToBuilderSpace(app1.id, founder1.id);
              const result2 = await teamFormationService.inviteToBuilderSpace(app2.id, founder2.id);

              // Verify member1 has access to team1's Builder Space but NOT team2's
              const member1HasAccessToTeam1 = await teamFormationService.validateBuilderSpaceAccess(
                member1.id,
                result1.builderSpace.id
              );
              expect(member1HasAccessToTeam1).toBe(true);

              const member1HasAccessToTeam2 = await teamFormationService.validateBuilderSpaceAccess(
                member1.id,
                result2.builderSpace.id
              );
              expect(member1HasAccessToTeam2).toBe(false);

              // Verify member2 has access to team2's Builder Space but NOT team1's
              const member2HasAccessToTeam2 = await teamFormationService.validateBuilderSpaceAccess(
                member2.id,
                result2.builderSpace.id
              );
              expect(member2HasAccessToTeam2).toBe(true);

              const member2HasAccessToTeam1 = await teamFormationService.validateBuilderSpaceAccess(
                member2.id,
                result1.builderSpace.id
              );
              expect(member2HasAccessToTeam1).toBe(false);

              // Verify getBuilderSpace enforces access control
              let errorThrown = false;
              try {
                await builderSpaceService.getBuilderSpace(result2.builderSpace.id, member1.id);
              } catch (error: any) {
                errorThrown = true;
                expect(error.message).toContain('Access denied');
              }
              expect(errorThrown).toBe(true);
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM team_members');
              sqlite.exec('DELETE FROM team_spaces');
              sqlite.exec('DELETE FROM applications');
              sqlite.exec('DELETE FROM startups');
              sqlite.exec('DELETE FROM hackathons');
              sqlite.exec('DELETE FROM users');
              sqlite.exec('PRAGMA foreign_keys = ON');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reuse existing Builder Space when inviting multiple members to same team', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          fc.array(userArbitrary, { minLength: 2, maxLength: 5 }),
          postTypeArbitrary,
          async (founder, applicants, postType) => {
            try {
              // Ensure unique IDs and emails
              const allUsers = [founder, ...applicants];
              for (let i = 0; i < allUsers.length; i++) {
                for (let j = i + 1; j < allUsers.length; j++) {
                  if (allUsers[i].id === allUsers[j].id) {
                    allUsers[j].id = crypto.randomUUID();
                  }
                  if (allUsers[i].email === allUsers[j].email) {
                    allUsers[j].email = `user${j}_${allUsers[j].email}`;
                  }
                }
              }

              const now = new Date();

              // Insert all users
              await db.insert(users).values(
                allUsers.map(user => ({ ...user, createdAt: now, updatedAt: now }))
              );

              // Create post
              let postId: string;
              if (postType === 'startup') {
                const startup = fc.sample(startupArbitrary(founder.id), 1)[0];
                await db.insert(startups).values({
                  ...startup,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = startup.id;
              } else {
                const hackathon = fc.sample(hackathonArbitrary(founder.id), 1)[0];
                await db.insert(hackathons).values({
                  ...hackathon,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = hackathon.id;
              }

              // Create accepted applications for all applicants
              const applicationIds: string[] = [];
              for (const applicant of applicants) {
                const application = fc.sample(
                  applicationArbitrary(applicant.id, postType, postId),
                  1
                )[0];
                await db.insert(applications).values({
                  ...application,
                  status: 'accepted',
                  createdAt: now,
                  updatedAt: now,
                });
                applicationIds.push(application.id);
              }

              // Invite all applicants to Builder Space
              const results = [];
              for (const appId of applicationIds) {
                const result = await teamFormationService.inviteToBuilderSpace(appId, founder.id);
                results.push(result);
              }

              // Verify first invitation created a new space
              expect(results[0].isNewSpace).toBe(true);

              // Verify subsequent invitations reused the same space
              for (let i = 1; i < results.length; i++) {
                expect(results[i].isNewSpace).toBe(false);
                expect(results[i].builderSpace.id).toBe(results[0].builderSpace.id);
              }

              // Verify exactly one Builder Space exists for this team
              const spaces = await db
                .select()
                .from(teamSpaces)
                .where(
                  and(
                    eq(teamSpaces.postType, postType),
                    eq(teamSpaces.postId, postId)
                  )
                );
              expect(spaces).toHaveLength(1);

              // Verify all members have access to the same Builder Space
              for (const applicant of applicants) {
                const hasAccess = await teamFormationService.validateBuilderSpaceAccess(
                  applicant.id,
                  results[0].builderSpace.id
                );
                expect(hasAccess).toBe(true);
              }

              // Verify all team members are recorded
              const members = await db
                .select()
                .from(teamMembers)
                .where(
                  and(
                    eq(teamMembers.postType, postType),
                    eq(teamMembers.postId, postId)
                  )
                );
              expect(members).toHaveLength(applicants.length);
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM team_members');
              sqlite.exec('DELETE FROM team_spaces');
              sqlite.exec('DELETE FROM applications');
              sqlite.exec('DELETE FROM startups');
              sqlite.exec('DELETE FROM hackathons');
              sqlite.exec('DELETE FROM users');
              sqlite.exec('PRAGMA foreign_keys = ON');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent duplicate team membership when inviting same applicant twice', async () => {
      await fc.assert(
        fc.asyncProperty(
          userArbitrary,
          userArbitrary,
          postTypeArbitrary,
          async (founder, applicant, postType) => {
            try {
              // Ensure unique IDs and emails
              if (founder.id === applicant.id) {
                applicant.id = crypto.randomUUID();
              }
              if (founder.email === applicant.email) {
                applicant.email = 'alt_' + applicant.email;
              }

              const now = new Date();

              // Insert users
              await db.insert(users).values([
                { ...founder, createdAt: now, updatedAt: now },
                { ...applicant, createdAt: now, updatedAt: now },
              ]);

              // Create post
              let postId: string;
              if (postType === 'startup') {
                const startup = fc.sample(startupArbitrary(founder.id), 1)[0];
                await db.insert(startups).values({
                  ...startup,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = startup.id;
              } else {
                const hackathon = fc.sample(hackathonArbitrary(founder.id), 1)[0];
                await db.insert(hackathons).values({
                  ...hackathon,
                  createdAt: now,
                  updatedAt: now,
                });
                postId = hackathon.id;
              }

              // Create accepted application
              const application = fc.sample(
                applicationArbitrary(applicant.id, postType, postId),
                1
              )[0];
              await db.insert(applications).values({
                ...application,
                status: 'accepted',
                createdAt: now,
                updatedAt: now,
              });

              // First invitation should succeed
              const result1 = await teamFormationService.inviteToBuilderSpace(
                application.id,
                founder.id
              );
              expect(result1.teamMember).toBeDefined();

              // Second invitation should fail with duplicate error
              let errorThrown = false;
              try {
                await teamFormationService.inviteToBuilderSpace(application.id, founder.id);
              } catch (error: any) {
                errorThrown = true;
                expect(error.message).toContain('already a team member');
              }
              expect(errorThrown).toBe(true);

              // Verify still only one team membership exists
              const members = await db
                .select()
                .from(teamMembers)
                .where(
                  and(
                    eq(teamMembers.userId, applicant.id),
                    eq(teamMembers.postType, postType),
                    eq(teamMembers.postId, postId)
                  )
                );
              expect(members).toHaveLength(1);
            } finally {
              // Clean up
              sqlite.exec('PRAGMA foreign_keys = OFF');
              sqlite.exec('DELETE FROM team_members');
              sqlite.exec('DELETE FROM team_spaces');
              sqlite.exec('DELETE FROM applications');
              sqlite.exec('DELETE FROM startups');
              sqlite.exec('DELETE FROM hackathons');
              sqlite.exec('DELETE FROM users');
              sqlite.exec('PRAGMA foreign_keys = ON');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
