import { Router } from 'express';
import { z } from 'zod';
import { User, Hackathon, Application, TeamSpace, TeamMember, insertHackathonSchema } from '../db/index.js';
import { authenticateToken, AuthRequest, optionalAuth } from '../middleware/auth.js';
import { broadcastStatsUpdate } from '../utils/statsHelper.js';

const router = Router();

// Get user's own hackathons
router.get('/my', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userHackathons = await Hackathon.find({ creatorId: req.user!.id })
      .select('id name description teamSize deadline skillsNeeded creatorId createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({ hackathons: userHackathons });
  } catch (error) {
    console.error('Get user hackathons error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all hackathons with optional filtering
router.get('/', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { search, upcoming, limit = '20', offset = '0' } = req.query;

    // Build filter conditions
    const filter: any = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (upcoming === 'true') {
      filter.deadline = { $gte: new Date() };
    }

    const result = await Hackathon.find(filter)
      .populate('creatorId', 'id name avatar')
      .select('id name description teamSize deadline skillsNeeded createdAt')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .skip(parseInt(offset as string))
      .lean();

    // Transform to match expected format
    const hackathons = result.map((h: any) => ({
      id: h.id,
      name: h.name,
      description: h.description,
      teamSize: h.teamSize,
      deadline: h.deadline,
      skillsNeeded: h.skillsNeeded,
      createdAt: h.createdAt,
      creator: h.creatorId ? {
        id: h.creatorId.id,
        name: h.creatorId.name,
        avatar: h.creatorId.avatar,
      } : null,
    }));

    res.json({ hackathons });
  } catch (error: any) {
    console.error('Get hackathons error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get hackathon by ID
router.get('/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const hackathon = await Hackathon.findById(id)
      .populate('creatorId', 'id name avatar college city bio')
      .lean();

    if (!hackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    // Check if current user has applied or is the creator
    let hasApplied = false;
    let isCreator = false;
    if (req.user) {
      // Check if user is the creator
      isCreator = hackathon.creatorId && (hackathon.creatorId as any).id === req.user.id;

      // Only check for applications if user is not the creator
      if (!isCreator) {
        const application = await Application.findOne({
          applicantId: req.user.id,
          postId: id,
          postType: 'hackathon'
        });

        hasApplied = !!application;
      }
    }

    // Transform to match expected format
    const result = {
      id: hackathon.id,
      name: hackathon.name,
      description: hackathon.description,
      teamSize: hackathon.teamSize,
      deadline: hackathon.deadline,
      skillsNeeded: hackathon.skillsNeeded,
      createdAt: hackathon.createdAt,
      creator: hackathon.creatorId ? {
        id: (hackathon.creatorId as any).id,
        name: (hackathon.creatorId as any).name,
        avatar: (hackathon.creatorId as any).avatar,
        college: (hackathon.creatorId as any).college,
        city: (hackathon.creatorId as any).city,
        bio: (hackathon.creatorId as any).bio,
      } : null,
    };

    res.json({ 
      hackathon: result,
      hasApplied,
      isCreator
    });
  } catch (error: any) {
    console.error('Get hackathon error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new hackathon
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const hackathonData = insertHackathonSchema.parse(req.body);

    const newHackathon = await Hackathon.create({
      ...hackathonData,
      creatorId: req.user!.id,
    });

    // Auto-create Builder Space (workspace) for this hackathon
    const workspace = await TeamSpace.create({
      postType: 'hackathon',
      postId: newHackathon.id,
      name: `${newHackathon.name} Workspace`,
      description: `Collaboration workspace for ${newHackathon.name}`,
    });

    // Add creator as first team member
    await TeamMember.create({
      userId: req.user!.id,
      postType: 'hackathon',
      postId: newHackathon.id,
      role: 'founder',
      joinedAt: new Date(),
    });

    // Broadcast stats update
    broadcastStatsUpdate();

    res.status(201).json({
      message: 'Hackathon created successfully',
      hackathon: {
        id: newHackathon.id,
        name: newHackathon.name,
        description: newHackathon.description,
        teamSize: newHackathon.teamSize,
        deadline: newHackathon.deadline,
        skillsNeeded: newHackathon.skillsNeeded,
        createdAt: newHackathon.createdAt,
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
  } catch (error: any) {
    console.error('Create hackathon error:', error?.message || error);
    if (error instanceof z.ZodError) {
      console.error('Validation errors:', error.errors);
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update hackathon (only by creator)
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updateData = insertHackathonSchema.partial().parse(req.body);

    // Check if user is the creator
    const hackathon = await Hackathon.findById(id);

    if (!hackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    if (hackathon.creatorId.toString() !== req.user!.id) {
      return res.status(403).json({ error: 'Only the creator can update this hackathon' });
    }

    const updatedHackathon = await Hackathon.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    res.json({
      message: 'Hackathon updated successfully',
      hackathon: updatedHackathon,
    });
  } catch (error: any) {
    console.error('Update hackathon error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete hackathon (only by creator)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Check if user is the creator
    const hackathon = await Hackathon.findById(id);

    if (!hackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    if (hackathon.creatorId.toString() !== req.user!.id) {
      return res.status(403).json({ error: 'Only the creator can delete this hackathon' });
    }

    // Delete related applications first
    await Application.deleteMany({
      postId: id,
      postType: 'hackathon'
    });

    // Delete hackathon
    await Hackathon.findByIdAndDelete(id);

    res.json({ message: 'Hackathon deleted successfully' });
  } catch (error: any) {
    console.error('Delete hackathon error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;