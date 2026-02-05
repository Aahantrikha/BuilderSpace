import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { validateScreeningChatAccess } from '../middleware/screeningChatAuth.js';
import { screeningChatService } from '../services/ScreeningChatService.js';
import { screeningMessageService } from '../services/ScreeningMessageService.js';

const router = Router();

/**
 * GET /api/screening-chats
 * Get all screening chats for the authenticated user
 */
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const screeningChats = await screeningChatService.getUserScreeningChats(req.user!.id);
    res.json({ screeningChats });
  } catch (error: any) {
    console.error('Get screening chats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/screening-chats
 * Create a new screening chat (typically called when accepting an application)
 */
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { applicationId } = req.body;

    if (!applicationId) {
      return res.status(400).json({ error: 'Application ID is required' });
    }

    const screeningChat = await screeningChatService.createScreeningChat(
      applicationId,
      req.user!.id
    );

    res.status(201).json({ screeningChat });
  } catch (error: any) {
    console.error('Create screening chat error:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('Access denied') || error.message.includes('Only the founder')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/screening-chats/:id
 * Get a specific screening chat with authorization check
 */
router.get('/:id', authenticateToken, validateScreeningChatAccess, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const screeningChat = await screeningChatService.getScreeningChat(id, req.user!.id);
    res.json({ screeningChat });
  } catch (error: any) {
    console.error('Get screening chat error:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('Access denied')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/screening-chats/:id/messages
 * Send a message in a screening chat
 */
router.post('/:id/messages', authenticateToken, validateScreeningChatAccess, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const message = await screeningMessageService.sendScreeningMessage({
      applicationId: id,
      senderId: req.user!.id,
      content,
    });

    res.status(201).json({ message });
  } catch (error: any) {
    console.error('Send screening message error:', error);
    if (error.message.includes('Access denied')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message.includes('empty') || error.message.includes('exceed')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/screening-chats/:id/messages
 * Get message history for a screening chat
 */
router.get('/:id/messages', authenticateToken, validateScreeningChatAccess, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const messages = await screeningMessageService.getScreeningMessages(id, req.user!.id);
    res.json({ messages });
  } catch (error: any) {
    console.error('Get screening messages error:', error);
    if (error.message.includes('Access denied')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
