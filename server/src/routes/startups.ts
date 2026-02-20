import { Router } from 'express';
import { z } from 'zod';
import { User, Startup, Application, TeamSpace, TeamMember, insertStartupSchema } from '../db/index.js';
import { authenticateToken, AuthRequest, optionalAuth } from '../middleware/auth.js';
import { broadcastStatsUpdate } from '../utils/statsHelper.js';

const router = Router();

// Get user's own startups
router.get('/my', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userStartups = await Startup.find({ founderId: req.user!.id })
      .select('id name description stage skillsNeeded founderId createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({ startups: userStartups });
  } catch (error) {
    console.error('Get user startups error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all startups with optional filtering
router.get('/', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { search, stage, limit = '20', offset = '0' } = req.query;

    // Build filter conditions
    const filter: any = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (stage) {
      filter.stage = stage;
    }

    const result = await Startup.find(filter)
      .populate('founderId', 'id name avatar')
      .select('id name description stage skillsNeeded createdAt')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .skip(parseInt(offset as string))
      .lean();

    // Transform to match expected format
    const startups = result.map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      stage: s.stage,
      skillsNeeded: s.skillsNeeded,
      createdAt: s.createdAt,
      founder: s.founderId ? {
        id: s.founderId.id,
        name: s.founderId.name,
        avatar: s.founderId.avatar,
      } : null,
    }));

    res.json({ startups });
  } catch (error: any) {
    console.error('Get startups error:', error?.message || error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get startup by ID
router.get('/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const startup = await Startup.findById(id)
      .populate('founderId', 'id name avatar college city bio')
      .lean();

    if (!startup) {
      return res.status(404).json({ error: 'Startup not found' });
    }

    // Check if current user has applied or is the founder
    let hasApplied = false;
    let isFounder = false;
    if (req.user) {
      // Check if user is the founder
      isFounder = startup.founderId && (startup.founderId as any).id === req.user.id;

      // Only check for applications if user is not the founder
      if (!isFounder) {
        const application = await Application.findOne({
          applicantId: req.user.id,
          postId: id,
          postType: 'startup'
        });

        hasApplied = !!application;
      }
    }

    // Transform to match expected format
    const result = {
      id: startup.id,
      name: startup.name,
      description: startup.description,
      stage: startup.stage,
      skillsNeeded: startup.skillsNeeded,
      createdAt: startup.createdAt,
      founder: startup.founderId ? {
        id: (startup.founderId as any).id,
        name: (startup.founderId as any).name,
        avatar: (startup.founderId as any).avatar,
        college: (startup.founderId as any).college,
        city: (startup.founderId as any).city,
        bio: (startup.founderId as any).bio,
      } : null,
    };

    res.json({ 
      startup: result,
      hasApplied,
      isFounder
    });
  } catch (error: any) {
    console.error('Get startup error:', error?.message || error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new startup
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const startupData = insertStartupSchema.parse(req.body);

    const newStartup = await Startup.create({
      ...startupData,
      founderId: req.user!.id,
    });

    // Auto-create Builder Space (workspace) for this startup
    const workspace = await TeamSpace.create({
      postType: 'startup',
      postId: newStartup._id.toString(),
      name: `${newStartup.name} Workspace`,
      description: `Collaboration workspace for ${newStartup.name}`,
    });

    // Add founder as first team member
    await TeamMember.create({
      userId: req.user!.id,
      postType: 'startup',
      postId: newStartup._id.toString(),
      role: 'founder',
      joinedAt: new Date(),
    });

    // Broadcast stats update
    broadcastStatsUpdate();

    res.status(201).json({
      message: 'Startup created successfully',
      startup: {
        id: newStartup.id,
        name: newStartup.name,
        description: newStartup.description,
        stage: newStartup.stage,
        skillsNeeded: newStartup.skillsNeeded,
        createdAt: newStartup.createdAt,
      },
      workspace: {
        id: workspace.id,
        postType: workspace.postType,
        postId: workspace.postId,
        name: workspace.name,
        description: workspace.description,
        createdAt: workspace.createdAt,
      },
    });
  } catch (error) {
    console.error('Create startup error:', (error as any)?.message || error);
    if (error instanceof z.ZodError) {
      console.error('Validation errors:', error.errors);
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update startup (only by founder)
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updateData = insertStartupSchema.partial().parse(req.body);

    // Check if user is the founder
    const startup = await Startup.findById(id);

    if (!startup) {
      return res.status(404).json({ error: 'Startup not found' });
    }

    if (startup.founderId.toString() !== req.user!.id) {
      return res.status(403).json({ error: 'Only the founder can update this startup' });
    }

    const updatedStartup = await Startup.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    res.json({
      message: 'Startup updated successfully',
      startup: updatedStartup,
    });
  } catch (error: any) {
    console.error('Update startup error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete startup (only by founder)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Check if user is the founder
    const startup = await Startup.findById(id);

    if (!startup) {
      return res.status(404).json({ error: 'Startup not found' });
    }

    if (startup.founderId.toString() !== req.user!.id) {
      return res.status(403).json({ error: 'Only the founder can delete this startup' });
    }

    // Delete related applications first
    await Application.deleteMany({
      postId: id,
      postType: 'startup'
    });

    // Delete startup
    await Startup.findByIdAndDelete(id);

    res.json({ message: 'Startup deleted successfully' });
  } catch (error: any) {
    console.error('Delete startup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;