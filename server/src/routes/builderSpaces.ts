import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { builderSpaceService } from '../services/BuilderSpaceService.js';
import { groupChatService } from '../services/GroupChatService.js';
import { sharedLinkService } from '../services/SharedLinkService.js';
import { taskService } from '../services/TaskService.js';

const router = Router();

// Get all Builder Spaces for the current user
router.get('/my', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const spaces = await builderSpaceService.getUserBuilderSpaces(userId);
    res.json({ spaces });
  } catch (error: any) {
    console.error('Get user Builder Spaces error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Builder Space by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const space = await builderSpaceService.getBuilderSpace(id, userId);

    if (!space) {
      return res.status(404).json({ error: 'Builder Space not found or access denied' });
    }

    res.json({ space });
  } catch (error: any) {
    console.error('Get Builder Space error:', error);
    res.status(500).json({ error: 'Internal server error' });
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

    const message = await groupChatService.sendGroupMessage(id, userId, content);

    res.status(201).json({
      message: 'Message sent successfully',
      data: message,
    });
  } catch (error: any) {
    console.error('Send group message error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error.message.includes('not found') || error.message.includes('not a member')) {
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

    const link = await sharedLinkService.addSharedLink(id, userId, title, url, description);

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

    const task = await taskService.createTask(id, userId, title, description);

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

    const task = await taskService.updateTaskStatus(taskId, userId, completed);

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

export default router;
