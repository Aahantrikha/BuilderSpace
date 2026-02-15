import { Router } from 'express';
import { z } from 'zod';
import { db, applications, startups, hackathons, users, teamMembers, insertApplicationSchema } from '../db/index.js';
import { eq, desc, and, or, inArray } from 'drizzle-orm';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { broadcastStatsUpdate } from '../utils/statsHelper.js';

const router = Router();

// Apply to startup or hackathon
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const applicationData = insertApplicationSchema.parse(req.body);

    // Check if post exists
    if (applicationData.postType === 'startup') {
      const startup = await db
        .select()
        .from(startups)
        .where(eq(startups.id, applicationData.postId))
        .limit(1);

      if (!startup.length) {
        return res.status(404).json({ error: 'Startup not found' });
      }

      // Check if user is not the founder
      if (startup[0].founderId === req.user!.id) {
        return res.status(400).json({ error: 'You cannot apply to your own startup' });
      }
    } else {
      const hackathon = await db
        .select()
        .from(hackathons)
        .where(eq(hackathons.id, applicationData.postId))
        .limit(1);

      if (!hackathon.length) {
        return res.status(404).json({ error: 'Hackathon not found' });
      }

      // Check if user is not the creator
      if (hackathon[0].creatorId === req.user!.id) {
        return res.status(400).json({ error: 'You cannot apply to your own hackathon' });
      }
    }

    // Check if user has already applied
    const existingApplication = await db
      .select()
      .from(applications)
      .where(
        and(
          eq(applications.applicantId, req.user!.id),
          eq(applications.postId, applicationData.postId),
          eq(applications.postType, applicationData.postType)
        )
      )
      .limit(1);

    if (existingApplication.length > 0) {
      return res.status(400).json({ error: 'You have already applied to this post' });
    }

    // Create application
    const newApplication = await db
      .insert(applications)
      .values({
        ...applicationData,
        applicantId: req.user!.id,
      })
      .returning();

    // Broadcast stats update
    broadcastStatsUpdate();

    res.status(201).json({
      message: 'Application submitted successfully',
      application: newApplication[0],
    });
  } catch (error: any) {
    console.error('Create application error:', error?.message || error);
    if (error instanceof z.ZodError) {
      console.error('Validation errors:', error.errors);
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's applications
router.get('/my', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userApplications = await db
      .select({
        id: applications.id,
        postType: applications.postType,
        postId: applications.postId,
        message: applications.message,
        status: applications.status,
        createdAt: applications.createdAt,
      })
      .from(applications)
      .where(eq(applications.applicantId, req.user!.id))
      .orderBy(desc(applications.createdAt));

    // Get post details for each application
    const applicationsWithDetails = await Promise.all(
      userApplications.map(async (app) => {
        if (app.postType === 'startup') {
          const startup = await db
            .select({
              id: startups.id,
              name: startups.name,
              stage: startups.stage,
              founder: {
                name: users.name,
                avatar: users.avatar,
              },
            })
            .from(startups)
            .leftJoin(users, eq(startups.founderId, users.id))
            .where(eq(startups.id, app.postId))
            .limit(1);

          return {
            ...app,
            post: startup[0] || null,
          };
        } else {
          const hackathon = await db
            .select({
              id: hackathons.id,
              name: hackathons.name,
              deadline: hackathons.deadline,
              creator: {
                name: users.name,
                avatar: users.avatar,
              },
            })
            .from(hackathons)
            .leftJoin(users, eq(hackathons.creatorId, users.id))
            .where(eq(hackathons.id, app.postId))
            .limit(1);

          return {
            ...app,
            post: hackathon[0] || null,
          };
        }
      })
    );

    res.json({ applications: applicationsWithDetails });
  } catch (error: any) {
    console.error('Get user applications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get applications for user's posts (startups/hackathons)
router.get('/received', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Get user's startups and hackathons
    const userStartups = await db
      .select({ id: startups.id })
      .from(startups)
      .where(eq(startups.founderId, req.user!.id));

    const userHackathons = await db
      .select({ id: hackathons.id })
      .from(hackathons)
      .where(eq(hackathons.creatorId, req.user!.id));

    const startupIds = userStartups.map(s => s.id);
    const hackathonIds = userHackathons.map(h => h.id);

    if (startupIds.length === 0 && hackathonIds.length === 0) {
      return res.json({ applications: [] });
    }

    // Get applications for user's posts
    const conditions = [];
    if (startupIds.length > 0) {
      conditions.push(
        and(
          eq(applications.postType, 'startup'),
          inArray(applications.postId, startupIds)
        )
      );
    }
    if (hackathonIds.length > 0) {
      conditions.push(
        and(
          eq(applications.postType, 'hackathon'),
          inArray(applications.postId, hackathonIds)
        )
      );
    }

    const receivedApplications = await db
      .select({
        id: applications.id,
        postType: applications.postType,
        postId: applications.postId,
        message: applications.message,
        status: applications.status,
        createdAt: applications.createdAt,
        applicant: {
          id: users.id,
          name: users.name,
          email: users.email,
          avatar: users.avatar,
          college: users.college,
          city: users.city,
          skills: users.skills,
        },
      })
      .from(applications)
      .leftJoin(users, eq(applications.applicantId, users.id))
      .where(or(...conditions))
      .orderBy(desc(applications.createdAt));

    // Get post details for each application
    const applicationsWithDetails = await Promise.all(
      receivedApplications.map(async (app) => {
        if (app.postType === 'startup') {
          const startup = await db
            .select({
              id: startups.id,
              name: startups.name,
              stage: startups.stage,
            })
            .from(startups)
            .where(eq(startups.id, app.postId))
            .limit(1);

          return {
            ...app,
            post: startup[0] || null,
          };
        } else {
          const hackathon = await db
            .select({
              id: hackathons.id,
              name: hackathons.name,
              deadline: hackathons.deadline,
            })
            .from(hackathons)
            .where(eq(hackathons.id, app.postId))
            .limit(1);

          return {
            ...app,
            post: hackathon[0] || null,
          };
        }
      })
    );

    res.json({ applications: applicationsWithDetails });
  } catch (error: any) {
    console.error('Get received applications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update application status (accept/reject)
router.put('/:id/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    console.log('PUT /applications/:id/status - Request received');
    console.log('Application ID:', req.params.id);
    console.log('Request body:', req.body);
    console.log('User:', req.user?.id);
    
    const { id } = req.params;
    const { status } = z.object({
      status: z.enum(['accepted', 'rejected']),
    }).parse(req.body);

    // Get application details
    const application = await db
      .select()
      .from(applications)
      .where(eq(applications.id, id))
      .limit(1);

    if (!application.length) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Check if user owns the post
    let isOwner = false;
    if (application[0].postType === 'startup') {
      const startup = await db
        .select()
        .from(startups)
        .where(eq(startups.id, application[0].postId))
        .limit(1);

      isOwner = startup.length > 0 && startup[0].founderId === req.user!.id;
    } else {
      const hackathon = await db
        .select()
        .from(hackathons)
        .where(eq(hackathons.id, application[0].postId))
        .limit(1);

      isOwner = hackathon.length > 0 && hackathon[0].creatorId === req.user!.id;
    }

    if (!isOwner) {
      return res.status(403).json({ error: 'You can only update applications for your own posts' });
    }

    // Update application status
    const updatedApplication = await db
      .update(applications)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(applications.id, id))
      .returning();

    // If application is accepted, create screening chat (but don't add to workspace yet)
    let screeningChat = null;
    if (status === 'accepted') {
      try {
        // Create screening chat
        const { screeningChatService } = await import('../services/ScreeningChatService.js');
        screeningChat = await screeningChatService.createScreeningChat(id);
        console.log('Screening chat created:', screeningChat);
        
        // Note: User will be added to workspace only when manually invited
      } catch (error: any) {
        console.error('Error in post-acceptance actions:', error);
        // Don't fail the request if these actions fail
        // The application is still accepted
      }
    }

    res.json({
      message: `Application ${status} successfully`,
      application: updatedApplication[0],
      screeningChat,
    });
  } catch (error: any) {
    console.error('Update application status error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;