import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { screeningChatService } from '../services/ScreeningChatService.js';

/**
 * Middleware to validate screening chat access
 * Ensures only the founder and applicant can access the screening chat
 * 
 * Usage: Add this middleware after authenticateToken on screening chat routes
 * The applicationId should be in req.params.id or req.params.applicationId
 */
export const validateScreeningChatAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get application ID from params (support both :id and :applicationId)
    const applicationId = req.params.id || req.params.applicationId;

    if (!applicationId) {
      return res.status(400).json({ error: 'Application ID is required' });
    }

    // Validate access
    const validation = await screeningChatService.validateScreeningChatAccess(
      applicationId,
      req.user.id
    );

    if (!validation.authorized) {
      return res.status(403).json({ 
        error: 'Access denied: You are not authorized to access this screening chat' 
      });
    }

    // Attach participants to request for use in route handlers
    (req as any).screeningChatParticipants = validation.participants;

    next();
  } catch (error: any) {
    console.error('Screening chat authorization error:', error);
    return res.status(403).json({ 
      error: error.message || 'Access denied' 
    });
  }
};
