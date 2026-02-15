import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { builderSpaceService } from '../services/BuilderSpaceService.js';
import { groupChatService } from '../services/GroupChatService.js';
import { sharedLinkService } from '../services/SharedLinkService.js';
import { taskService } from '../services/TaskService.js';
import { eq, and } from 'drizzle-orm';
import { db, teamSpaces, teamMembers, spaceLinks, spaceTasks, spaceMessages, startups, hackathons } from '../db/index.js';

const router = Router();

// Get all Builder Spaces for the current user
router.get('/my', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const spaces = await builderSpaceService.getUserBuilderSpaces(userId);
    
    // Add member count to each space
    const { db: dbInstance, teamMembers: teamMembersTable } = await import('../db/index.js');
    const spacesWithCount = await Promise.all(
      spaces.map(async (space) => {
        const members = await dbInstance
          .select()
          .from(teamMembersTable)
          .where(
            and(
              eq(teamMembersTable.postType, space.postType),
              eq(teamMembersTable.postId, space.postId)
            )
          );
        
        return {
          ...space,
          memberCount: members.length,
        };
      })
    );
    
    res.json({ spaces: spacesWithCount });
  } catch (error: any) {
    console.error('Get user Builder Spaces error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Invite user to Builder Space
router.post('/:id/invite', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    const { email } = z.object({
      email: z.string().email(),
    }).parse(req.body);

    // Get the space
    const space = await builderSpaceService.getBuilderSpace(id, userId);

    // Check if user is founder/creator (only they can invite)
    const { db: dbInstance, teamMembers: teamMembersTable } = await import('../db/index.js');
    const membership = await dbInstance
      .select()
      .from(teamMembersTable)
      .where(
        and(
          eq(teamMembersTable.userId, userId),
          eq(teamMembersTable.postType, space.postType),
          eq(teamMembersTable.postId, space.postId)
        )
      )
      .limit(1);

    if (!membership.length || membership[0].role !== 'founder') {
      return res.status(403).json({ error: 'Only the founder can invite members' });
    }

    // Find user by email
    const { users: usersTable } = await import('../db/index.js');
    const invitedUser = await dbInstance
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!invitedUser.length) {
      return res.status(404).json({ error: 'User not found with this email' });
    }

    // Check if already a member
    const existingMember = await dbInstance
      .select()
      .from(teamMembersTable)
      .where(
        and(
          eq(teamMembersTable.userId, invitedUser[0].id),
          eq(teamMembersTable.postType, space.postType),
          eq(teamMembersTable.postId, space.postId)
        )
      )
      .limit(1);

    if (existingMember.length > 0) {
      return res.status(400).json({ error: 'User is already a member of this workspace' });
    }

    // Add user to workspace
    await dbInstance
      .insert(teamMembersTable)
      .values({
        id: crypto.randomUUID(),
        userId: invitedUser[0].id,
        postType: space.postType,
        postId: space.postId,
        role: 'member',
        joinedAt: new Date(),
      });

    res.json({
      message: 'User invited successfully',
      user: {
        id: invitedUser[0].id,
        name: invitedUser[0].name,
        email: invitedUser[0].email,
      },
    });
  } catch (error: any) {
    console.error('Invite user error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get Builder Space by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    console.log('GET /builder-spaces/:id - Request received');
    console.log('Space ID:', id);
    console.log('User ID:', userId);

    const space = await builderSpaceService.getBuilderSpace(id, userId);

    if (!space) {
      console.log('Space not found or access denied');
      return res.status(404).json({ error: 'Builder Space not found or access denied' });
    }

    console.log('Space found:', space);
    res.json({ space });
  } catch (error: any) {
    console.error('Get Builder Space error:', error.message);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get members of a Builder Space
router.get('/:id/members', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Get the space to validate access
    const space = await builderSpaceService.getBuilderSpace(id, userId);

    // Get all members
    const { db: dbInstance, teamMembers: teamMembersTable, users: usersTable } = await import('../db/index.js');
    const membersData = await dbInstance
      .select({
        userId: teamMembersTable.userId,
        role: teamMembersTable.role,
        joinedAt: teamMembersTable.joinedAt,
        userName: usersTable.name,
        userEmail: usersTable.email,
        userAvatar: usersTable.avatar,
      })
      .from(teamMembersTable)
      .leftJoin(usersTable, eq(teamMembersTable.userId, usersTable.id))
      .where(
        and(
          eq(teamMembersTable.postType, space.postType),
          eq(teamMembersTable.postId, space.postId)
        )
      );

    // Check if current user is founder
    const isFounder = membersData.some(m => m.userId === userId && m.role === 'founder');

    res.json({
      members: membersData,
      isFounder,
    });
  } catch (error: any) {
    console.error('Get members error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Remove member from Builder Space
router.delete('/:id/members/:memberId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id, memberId } = req.params;
    const userId = req.user!.id;

    // Get the space
    const space = await builderSpaceService.getBuilderSpace(id, userId);

    // Check if user is founder
    const { db: dbInstance, teamMembers: teamMembersTable } = await import('../db/index.js');
    const membership = await dbInstance
      .select()
      .from(teamMembersTable)
      .where(
        and(
          eq(teamMembersTable.userId, userId),
          eq(teamMembersTable.postType, space.postType),
          eq(teamMembersTable.postId, space.postId)
        )
      )
      .limit(1);

    if (!membership.length || membership[0].role !== 'founder') {
      return res.status(403).json({ error: 'Only the founder can remove members' });
    }

    // Can't remove founder
    const targetMember = await dbInstance
      .select()
      .from(teamMembersTable)
      .where(
        and(
          eq(teamMembersTable.userId, memberId),
          eq(teamMembersTable.postType, space.postType),
          eq(teamMembersTable.postId, space.postId)
        )
      )
      .limit(1);

    if (!targetMember.length) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (targetMember[0].role === 'founder') {
      return res.status(400).json({ error: 'Cannot remove the founder' });
    }

    // Remove member
    await dbInstance
      .delete(teamMembersTable)
      .where(
        and(
          eq(teamMembersTable.userId, memberId),
          eq(teamMembersTable.postType, space.postType),
          eq(teamMembersTable.postId, space.postId)
        )
      );

    res.json({ message: 'Member removed successfully' });
  } catch (error: any) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Send group message in Builder Space
router.post('/:id/messages', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    const { content } = z.object({
      content: z.string().min(1).max(5000),
    }).parse(req.body);

    const messageData = await groupChatService.sendGroupMessage({
      spaceId: id,
      senderId: userId,
      content,
    });

    res.status(201).json({
      message: 'Message sent successfully',
      data: messageData,
    });
  } catch (error: any) {
    console.error('Send group message error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error.message.includes('not found') || error.message.includes('not a member') || error.message.includes('not authorized')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get group messages in Builder Space
router.get('/:id/messages', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const messages = await groupChatService.getGroupMessages(id, userId);

    res.json({ messages });
  } catch (error: any) {
    console.error('Get group messages error:', error);
    if (error.message.includes('not found') || error.message.includes('not a member')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add shared link to Builder Space
router.post('/:id/links', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    const { title, url, description } = z.object({
      title: z.string().min(1).max(200),
      url: z.string().url(),
      description: z.string().max(1000).optional(),
    }).parse(req.body);

    const link = await sharedLinkService.addSharedLink({
      spaceId: id,
      creatorId: userId,
      title,
      url,
      description,
    });

    res.status(201).json({
      message: 'Link added successfully',
      link,
    });
  } catch (error: any) {
    console.error('Add shared link error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error.message.includes('not found') || error.message.includes('not a member')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message.includes('Invalid URL')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get shared links in Builder Space
router.get('/:id/links', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const links = await sharedLinkService.getSharedLinks(id, userId);

    res.json({ links });
  } catch (error: any) {
    console.error('Get shared links error:', error);
    if (error.message.includes('not found') || error.message.includes('not a member')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove shared link from Builder Space
router.delete('/:id/links/:linkId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { linkId } = req.params;
    const userId = req.user!.id;

    await sharedLinkService.removeSharedLink(linkId, userId);

    res.json({ message: 'Link removed successfully' });
  } catch (error: any) {
    console.error('Remove shared link error:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('not authorized')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create task in Builder Space
router.post('/:id/tasks', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    const { title, description } = z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
    }).parse(req.body);

    const task = await taskService.createTask({
      spaceId: id,
      creatorId: userId,
      title,
      description,
    });

    res.status(201).json({
      message: 'Task created successfully',
      task,
    });
  } catch (error: any) {
    console.error('Create task error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error.message.includes('not found') || error.message.includes('not a member')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get tasks in Builder Space
router.get('/:id/tasks', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const tasks = await taskService.getTasks(id, userId);

    res.json({ tasks });
  } catch (error: any) {
    console.error('Get tasks error:', error);
    if (error.message.includes('not found') || error.message.includes('not a member')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update task status in Builder Space
router.put('/:id/tasks/:taskId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;
    
    const { completed } = z.object({
      completed: z.boolean(),
    }).parse(req.body);

    const task = await taskService.updateTaskStatus({
      taskId,
      userId,
      completed,
    });

    res.json({
      message: 'Task updated successfully',
      task,
    });
  } catch (error: any) {
    console.error('Update task error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('not a member')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete task from Builder Space
router.delete('/:id/tasks/:taskId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;

    await taskService.deleteTask(taskId, userId);

    res.json({ message: 'Task deleted successfully' });
  } catch (error: any) {
    console.error('Delete task error:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('not authorized')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete entire Builder Space (only by founder)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if user is the founder
    const space = await db.query.teamSpaces.findFirst({
      where: eq(teamSpaces.id, id),
    });

    if (!space) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Get the founder ID from the associated post
    let founderId: string | null = null;
    if (space.postType === 'startup') {
      const startup = await db.query.startups.findFirst({
        where: eq(startups.id, space.postId),
      });
      founderId = startup?.founderId || null;
    } else if (space.postType === 'hackathon') {
      const hackathon = await db.query.hackathons.findFirst({
        where: eq(hackathons.id, space.postId),
      });
      founderId = hackathon?.creatorId || null;
    }

    if (founderId !== userId) {
      return res.status(403).json({ error: 'Only the founder can delete this workspace' });
    }

    // Delete all related data
    await db.delete(teamMembers).where(eq(teamMembers.teamSpaceId, id));
    await db.delete(spaceLinks).where(eq(spaceLinks.spaceId, id));
    await db.delete(spaceTasks).where(eq(spaceTasks.spaceId, id));
    await db.delete(spaceMessages).where(eq(spaceMessages.spaceId, id));
    await db.delete(teamSpaces).where(eq(teamSpaces.id, id));

    res.json({ message: 'Workspace deleted successfully' });
  } catch (error: any) {
    console.error('Delete workspace error:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
