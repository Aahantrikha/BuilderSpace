import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db, users } from '../db/index.js';
import { eq } from 'drizzle-orm';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      email: string;
    };

    // Verify user still exists
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (!user.length) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user[0];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
        email: string;
      };

      const user = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
        })
        .from(users)
        .where(eq(users.id, decoded.userId))
        .limit(1);

      if (user.length) {
        req.user = user[0];
      }
    }

    next();
  } catch (error) {
    // Continue without auth if token is invalid
    next();
  }
};