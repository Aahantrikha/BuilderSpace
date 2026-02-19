import { Router } from 'express';
import { z } from 'zod';
import { Application, Startup, Hackathon, User, TeamMember, insertApplicationSchema } from '../db/index.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { broadcastStatsUpdate } from '../utils/statsHelper.js';

const router = Router();

// Apply to startup or hackathon
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const applicationData = insertApplicationSchema.parse(req.body);

    // Check if post exists
    if (applicationData.postType === 'startup') {
      const startup = await Startup.findById(applicationData.postId);

      if (!startup) {
        return res.status(404).json({ error: 'Startup not found' });
      }

      // Check if user is not the founder
      if (startup.founderId.toString() === req.user!.id) {
        return res.status(400).json({ error: 'You cannot apply to your own startup' });
      }
    } else {
      const hackathon = await Hackathon.findById(applicationData.postId);

      if (!hackathon) {
        return res.status(404).json({ error: 'Hackathon not found' });
      }

      // Check if user is not the creator
      if (hackathon.creatorId.toString() === req.user!.id) {
        return res.status(400).json({ error: 'You cannot apply to your own hackathon' });
      }
    }

    // Check if user has already applied
    const existingApplication = await Application.findOne({
      applicantId: req.user!.id,
      postId: applicationData.postId,
      postType: applicationData.postType
    });

    if (existingApplication) {
      return res.status(400).json({ error: 'You have already applied to this post' });
    }

    // Create application
    const newApplication = await Application.create({
      ...applicationData,
      applicantId: req.user!.id,
    });

    // Broadcast stats update
    broadcastStatsUpdate();

    res.status(201).json({
      message: 'Application submitted successfully',
      application: newApplication,
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
    const userApplications = await Application.find({ applicantId: req.user!.id })
      .select('id postType postId message status createdAt')
      .sort({ createdAt: -1 })
      .lean();

    // Get post details for each application
    const applicationsWithDetails = await Promise.all(
      userApplications.map(async (app: any) => {
        if (app.postType === 'startup') {
          const startup = await Startup.findById(app.postId)
            .populate('founderId', 'name avatar')
            .select('id name stage')
            .lean();

          return {
            ...app,
            post: startup ? {
              id: startup.id,
              name: startup.name,
              stage: startup.stage,
              founder: startup.founderId ? {
                name: (startup.founderId as any).name,
                avatar: (startup.founderId as any).avatar,
              } : null,
            } : null,
          };
        } else {
          const hackathon = await Hackathon.findById(app.postId)
            .populate('creatorId', 'name avatar')
            .select('id name deadline')
            .lean();

          return {
            ...app,
            post: hackathon ? {
              id: hackathon.id,
              name: hackathon.name,
              deadline: hackathon.deadline,
              creator: hackathon.creatorId ? {
                name: (hackathon.creatorId as any).name,
                avatar: (hackathon.creatorId as any).avatar,
              } : null,
            } : null,
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
    const userStartups = await Startup.find({ founderId: req.user!.id }).select('id').lean();
    const userHackathons = await Hackathon.find({ creatorId: req.user!.id }).select('id').lean();

    const startupIds = userStartups.map(s => s.id);
    const hackathonIds = userHackathons.map(h => h.id);

    if (startupIds.length === 0 && hackathonIds.length === 0) {
      return res.json({ applications: [] });
    }

    // Get applications for user's posts
    const conditions = [];
    if (startupIds.length > 0) {
      conditions.push({ postType: 'startup', postId: { $in: startupIds } });
    }
    if (hackathonIds.length > 0) {
      conditions.push({ postType: 'hackathon', postId: { $in: hackathonIds } });
    }

    const receivedApplications = await Application.find({ $or: conditions })
      .populate('applicantId', 'id name email avatar college city skills')
      .select('id postType postId message status createdAt')
      .sort({ createdAt: -1 })
      .lean();

    // Get post details for each application
    const applicationsWithDetails = await Promise.all(
      receivedApplications.map(async (app: any) => {
        if (app.postType === 'startup') {
          const startup = await Startup.findById(app.postId)
            .select('id name stage')
            .lean();

          return {
            ...app,
            applicant: app.applicantId ? {
              id: app.applicantId.id,
              name: app.applicantId.name,
              email: app.applicantId.email,
              avatar: app.applicantId.avatar,
              college: app.applicantId.college,
              city: app.applicantId.city,
              skills: app.applicantId.skills,
            } : null,
            post: startup || null,
          };
        } else {
          const hackathon = await Hackathon.findById(app.postId)
            .select('id name deadline')
            .lean();

          return {
            ...app,
            applicant: app.applicantId ? {
              id: app.applicantId.id,
              name: app.applicantId.name,
              email: app.applicantId.email,
              avatar: app.applicantId.avatar,
              college: app.applicantId.college,
              city: app.applicantId.city,
              skills: app.applicantId.skills,
            } : null,
            post: hackathon || null,
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
    const application = await Application.findById(id);

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Check if user owns the post
    let isOwner = false;
    if (application.postType === 'startup') {
      const startup = await Startup.findById(application.postId);
      isOwner = startup && startup.founderId.toString() === req.user!.id;
    } else {
      const hackathon = await Hackathon.findById(application.postId);
      isOwner = hackathon && hackathon.creatorId.toString() === req.user!.id;
    }

    if (!isOwner) {
      return res.status(403).json({ error: 'You can only update applications for your own posts' });
    }

    // Update application status
    application.status = status;
    await application.save();

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
      application,
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