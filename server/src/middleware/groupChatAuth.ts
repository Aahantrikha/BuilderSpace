import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { builderSpaceService } from '../services/BuilderSpaceService.js';
import { teamSpaces } from '../db/index.js';
import { db } from '../db/index.js';
import { eq } from 'drizzle-orm';

/**
 * Middleware to validate Builder Space group chat access
 * Ensures only team members can access the group chat
 * 
 * Usage: Add this middleware after authenticateToken on group chat routes
 * The spaceId should be in req.params.id or req.params.spaceId
 */
export const validateGroupChatAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get space ID from params (support both :id and :spaceId)
    const spaceId = req.params.id || req.params.spaceId;

    if (!spaceId) {
      return res.status(400).json({ error: 'Builder Space ID is required' });
    }

    // Get the space to validate it exists and get post info
    const space = await db
      .select()
      .from(teamSpaces)
      .where(eq(teamSpaces.id, spaceId))
      .limit(1);

    if (!space.length) {
      return res.status(404).json({ error: 'Builder Space not found' });
    }

    // Validate user is a team member
    const isAuthorized = await builderSpaceService.validateTeamMemberAccess(
      req.user.id,
      space[0].postType as 'startup' | 'hackathon',
      space[0].postId
    );

    if (!isAuthorized) {
      return res.status(403).json({ 
        error: 'Access denied: You are not authorized to access this Builder Space' 
      });
    }

    // Attach space info to request for use in route handlers
    (req as any).builderSpace = space[0];

    next();
  } catch (error: any) {
    console.error('Group chat authorization error:', error);
    return res.status(403).json({ 
      error: error.message || 'Access denied' 
    });
  }
};
