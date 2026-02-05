import { Router } from 'express';
import { z } from 'zod';
import { db, hackathons, users, applications, insertHackathonSchema, teamSpaces, teamMembers } from '../db/index.js';
import { eq, desc, ilike, or, and, gte } from 'drizzle-orm';
import { authenticateToken, AuthRequest, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Get user's own hackathons
router.get('/my', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userHackathons = await db
      .select({
        id: hackathons.id,
        name: hackathons.name,
        description: hackathons.description,
        teamSize: hackathons.teamSize,
        deadline: hackathons.deadline,
        skillsNeeded: hackathons.skillsNeeded,
        creatorId: hackathons.creatorId,
        createdAt: hackathons.createdAt,
        updatedAt: hackathons.updatedAt,
      })
      .from(hackathons)
      .where(eq(hackathons.creatorId, req.user!.id))
      .orderBy(desc(hackathons.createdAt));
    
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

    let query = db
      .select({
        id: hackathons.id,
        name: hackathons.name,
        description: hackathons.description,
        teamSize: hackathons.teamSize,
        deadline: hackathons.deadline,
        skillsNeeded: hackathons.skillsNeeded,
        createdAt: hackathons.createdAt,
        creator: {
          id: users.id,
          name: users.name,
          avatar: users.avatar,
        },
      })
      .from(hackathons)
      .leftJoin(users, eq(hackathons.creatorId, users.id))
      .orderBy(desc(hackathons.createdAt));

    // Apply filters
    const conditions = [];
    
    if (search) {
      conditions.push(
        or(
          ilike(hackathons.name, `%${search}%`),
          ilike(hackathons.description, `%${search}%`)
        )
      );
    }

    if (upcoming === 'true') {
      conditions.push(gte(hackathons.deadline, new Date()));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const result = await query
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({ hackathons: result });
  } catch (error: any) {
    console.error('Get hackathons error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get hackathon by ID
router.get('/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const hackathon = await db
      .select({
        id: hackathons.id,
        name: hackathons.name,
        description: hackathons.description,
        teamSize: hackathons.teamSize,
        deadline: hackathons.deadline,
        skillsNeeded: hackathons.skillsNeeded,
        createdAt: hackathons.createdAt,
        creator: {
          id: users.id,
          name: users.name,
          avatar: users.avatar,
          college: users.college,
          city: users.city,
          bio: users.bio,
        },
      })
      .from(hackathons)
      .leftJoin(users, eq(hackathons.creatorId, users.id))
      .where(eq(hackathons.id, id))
      .limit(1);

    if (!hackathon.length) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    // Check if current user has applied or is the creator
    let hasApplied = false;
    let isCreator = false;
    if (req.user) {
      // Check if user is the creator
      const hackathonRecord = await db
        .select()
        .from(hackathons)
        .where(eq(hackathons.id, id))
        .limit(1);
      
      if (hackathonRecord.length > 0) {
        isCreator = hackathonRecord[0].creatorId === req.user.id;
      }

      // Only check for applications if user is not the creator
      if (!isCreator) {
        const application = await db
          .select()
          .from(applications)
          .where(
            and(
              eq(applications.applicantId, req.user.id),
              eq(applications.postId, id),
              eq(applications.postType, 'hackathon')
            )
          )
          .limit(1);

        hasApplied = application.length > 0;
      }
    }

    res.json({ 
      hackathon: hackathon[0],
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

    const newHackathon = await db
      .insert(hackathons)
      .values({
        ...hackathonData,
        creatorId: req.user!.id,
      })
      .returning({
        id: hackathons.id,
        name: hackathons.name,
        description: hackathons.description,
        teamSize: hackathons.teamSize,
        deadline: hackathons.deadline,
        skillsNeeded: hackathons.skillsNeeded,
        createdAt: hackathons.createdAt,
      });

    // Auto-create Builder Space (workspace) for this hackathon
    const workspace = await db
      .insert(teamSpaces)
      .values({
        id: crypto.randomUUID(),
        postType: 'hackathon',
        postId: newHackathon[0].id,
        name: `${newHackathon[0].name} Workspace`,
        description: `Collaboration workspace for ${newHackathon[0].name}`,
        createdAt: new Date(),
      })
      .returning();

    // Add creator as first team member
    await db
      .insert(teamMembers)
      .values({
        id: crypto.randomUUID(),
        userId: req.user!.id,
        postType: 'hackathon',
        postId: newHackathon[0].id,
        role: 'founder',
        joinedAt: new Date(),
      });

    res.status(201).json({
      message: 'Hackathon created successfully',
      hackathon: newHackathon[0],
      workspace: workspace[0],
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
    const hackathon = await db
      .select()
      .from(hackathons)
      .where(eq(hackathons.id, id))
      .limit(1);

    if (!hackathon.length) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    if (hackathon[0].creatorId !== req.user!.id) {
      return res.status(403).json({ error: 'Only the creator can update this hackathon' });
    }

    const updatedHackathon = await db
      .update(hackathons)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(hackathons.id, id))
      .returning();

    res.json({
      message: 'Hackathon updated successfully',
      hackathon: updatedHackathon[0],
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
    const hackathon = await db
      .select()
      .from(hackathons)
      .where(eq(hackathons.id, id))
      .limit(1);

    if (!hackathon.length) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    if (hackathon[0].creatorId !== req.user!.id) {
      return res.status(403).json({ error: 'Only the creator can delete this hackathon' });
    }

    // Delete related applications first
    await db
      .delete(applications)
      .where(
        and(
          eq(applications.postId, id),
          eq(applications.postType, 'hackathon')
        )
      );

    // Delete hackathon
    await db.delete(hackathons).where(eq(hackathons.id, id));

    res.json({ message: 'Hackathon deleted successfully' });
  } catch (error: any) {
    console.error('Delete hackathon error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;