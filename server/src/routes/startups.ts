import { Router } from 'express';
import { z } from 'zod';
import { db, startups, users, applications, insertStartupSchema, teamSpaces, teamMembers } from '../db/index.js';
import { eq, desc, ilike, or, and } from 'drizzle-orm';
import { authenticateToken, AuthRequest, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Get user's own startups
router.get('/my', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userStartups = await db
      .select({
        id: startups.id,
        name: startups.name,
        description: startups.description,
        stage: startups.stage,
        skillsNeeded: startups.skillsNeeded,
        founderId: startups.founderId,
        createdAt: startups.createdAt,
        updatedAt: startups.updatedAt,
      })
      .from(startups)
      .where(eq(startups.founderId, req.user!.id))
      .orderBy(desc(startups.createdAt));
    
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

    let query = db
      .select({
        id: startups.id,
        name: startups.name,
        description: startups.description,
        stage: startups.stage,
        skillsNeeded: startups.skillsNeeded,
        createdAt: startups.createdAt,
        founder: {
          id: users.id,
          name: users.name,
          avatar: users.avatar,
        },
      })
      .from(startups)
      .leftJoin(users, eq(startups.founderId, users.id))
      .orderBy(desc(startups.createdAt));

    // Apply filters
    const conditions = [];
    
    if (search) {
      conditions.push(
        or(
          ilike(startups.name, `%${search}%`),
          ilike(startups.description, `%${search}%`)
        )
      );
    }

    if (stage) {
      conditions.push(eq(startups.stage, stage as string));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const result = await query
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({ startups: result });
  } catch (error: any) {
    console.error('Get startups error:', error?.message || error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get startup by ID
router.get('/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const startup = await db
      .select({
        id: startups.id,
        name: startups.name,
        description: startups.description,
        stage: startups.stage,
        skillsNeeded: startups.skillsNeeded,
        createdAt: startups.createdAt,
        founder: {
          id: users.id,
          name: users.name,
          avatar: users.avatar,
          college: users.college,
          city: users.city,
          bio: users.bio,
        },
      })
      .from(startups)
      .leftJoin(users, eq(startups.founderId, users.id))
      .where(eq(startups.id, id))
      .limit(1);

    if (!startup.length) {
      return res.status(404).json({ error: 'Startup not found' });
    }

    // Check if current user has applied or is the founder
    let hasApplied = false;
    let isFounder = false;
    if (req.user) {
      // Check if user is the founder
      const startupRecord = await db
        .select()
        .from(startups)
        .where(eq(startups.id, id))
        .limit(1);
      
      if (startupRecord.length > 0) {
        isFounder = startupRecord[0].founderId === req.user.id;
      }

      // Only check for applications if user is not the founder
      if (!isFounder) {
        const application = await db
          .select()
          .from(applications)
          .where(
            and(
              eq(applications.applicantId, req.user.id),
              eq(applications.postId, id),
              eq(applications.postType, 'startup')
            )
          )
          .limit(1);

        hasApplied = application.length > 0;
      }
    }

    res.json({ 
      startup: startup[0],
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

    const newStartup = await db
      .insert(startups)
      .values({
        ...startupData,
        founderId: req.user!.id,
      })
      .returning({
        id: startups.id,
        name: startups.name,
        description: startups.description,
        stage: startups.stage,
        skillsNeeded: startups.skillsNeeded,
        createdAt: startups.createdAt,
      });

    // Auto-create Builder Space (workspace) for this startup
    const workspace = await db
      .insert(teamSpaces)
      .values({
        id: crypto.randomUUID(),
        postType: 'startup',
        postId: newStartup[0].id,
        name: `${newStartup[0].name} Workspace`,
        description: `Collaboration workspace for ${newStartup[0].name}`,
        createdAt: new Date(),
      })
      .returning();

    // Add founder as first team member
    await db
      .insert(teamMembers)
      .values({
        id: crypto.randomUUID(),
        userId: req.user!.id,
        postType: 'startup',
        postId: newStartup[0].id,
        role: 'founder',
        joinedAt: new Date(),
      });

    res.status(201).json({
      message: 'Startup created successfully',
      startup: newStartup[0],
      workspace: workspace[0],
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
    const startup = await db
      .select()
      .from(startups)
      .where(eq(startups.id, id))
      .limit(1);

    if (!startup.length) {
      return res.status(404).json({ error: 'Startup not found' });
    }

    if (startup[0].founderId !== req.user!.id) {
      return res.status(403).json({ error: 'Only the founder can update this startup' });
    }

    const updatedStartup = await db
      .update(startups)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(startups.id, id))
      .returning();

    res.json({
      message: 'Startup updated successfully',
      startup: updatedStartup[0],
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
    const startup = await db
      .select()
      .from(startups)
      .where(eq(startups.id, id))
      .limit(1);

    if (!startup.length) {
      return res.status(404).json({ error: 'Startup not found' });
    }

    if (startup[0].founderId !== req.user!.id) {
      return res.status(403).json({ error: 'Only the founder can delete this startup' });
    }

    // Delete related applications first
    await db
      .delete(applications)
      .where(
        and(
          eq(applications.postId, id),
          eq(applications.postType, 'startup')
        )
      );

    // Delete startup
    await db.delete(startups).where(eq(startups.id, id));

    res.json({ message: 'Startup deleted successfully' });
  } catch (error: any) {
    console.error('Delete startup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;