import { Router } from 'express';
import { z } from 'zod';
import { db, users, insertUserSchema } from '../db/index.js';
import { eq, or } from 'drizzle-orm';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateTokens } from '../utils/jwt.js';
import { verifyGoogleToken, getGoogleAuthUrl } from '../utils/google-auth.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Validation schemas
const signupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const googleAuthSchema = z.object({
  token: z.string().min(1, 'Google token is required'),
});

// Sign up with email
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = signupSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const newUser = await db
      .insert(users)
      .values({
        name,
        email,
        password: hashedPassword,
        emailVerified: false,
        onboardingCompleted: false,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        avatar: users.avatar,
        onboardingCompleted: users.onboardingCompleted,
      });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(newUser[0].id, newUser[0].email);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.status(201).json({
      message: 'Account created successfully',
      user: newUser[0],
      accessToken,
    });
  } catch (error) {
    console.error('Signup error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login with email
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user.length || !user[0].password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user[0].password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user[0].id, user[0].email);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user[0].id,
        name: user[0].name,
        email: user[0].email,
        avatar: user[0].avatar,
        college: user[0].college,
        city: user[0].city,
        bio: user[0].bio,
        skills: user[0].skills,
        preferences: user[0].preferences,
        onboardingCompleted: user[0].onboardingCompleted,
      },
      accessToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Google OAuth login
router.post('/google', async (req, res) => {
  try {
    const { token } = googleAuthSchema.parse(req.body);

    // Verify Google token
    const googleUser = await verifyGoogleToken(token);

    // Check if user exists
    let user = await db
      .select()
      .from(users)
      .where(or(
        eq(users.email, googleUser.email),
        eq(users.googleId, googleUser.googleId)
      ))
      .limit(1);

    if (!user.length) {
      // Create new user
      const newUser = await db
        .insert(users)
        .values({
          name: googleUser.name,
          email: googleUser.email,
          googleId: googleUser.googleId,
          avatar: googleUser.avatar,
          emailVerified: googleUser.emailVerified,
          onboardingCompleted: false,
        })
        .returning();

      user = newUser;
    } else {
      // Update existing user with Google info if not set
      if (!user[0].googleId) {
        await db
          .update(users)
          .set({
            googleId: googleUser.googleId,
            avatar: googleUser.avatar || user[0].avatar,
            emailVerified: googleUser.emailVerified || user[0].emailVerified,
          })
          .where(eq(users.id, user[0].id));
      }
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user[0].id, user[0].email);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({
      message: 'Google login successful',
      user: {
        id: user[0].id,
        name: user[0].name,
        email: user[0].email,
        avatar: user[0].avatar,
        college: user[0].college,
        city: user[0].city,
        bio: user[0].bio,
        skills: user[0].skills,
        preferences: user[0].preferences,
        onboardingCompleted: user[0].onboardingCompleted,
      },
      accessToken,
    });
  } catch (error) {
    console.error('Google auth error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// Get Google Auth URL
router.get('/google/url', (req, res) => {
  try {
    const authUrl = getGoogleAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    console.error('Google auth URL error:', error);
    res.status(500).json({ error: 'Failed to generate Google auth URL' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});

// Get current user
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatar: users.avatar,
        college: users.college,
        city: users.city,
        bio: users.bio,
        skills: users.skills,
        preferences: users.preferences,
        onboardingCompleted: users.onboardingCompleted,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);

    if (!user.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: user[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const updateData = insertUserSchema.partial().parse(req.body);
    delete (updateData as any).id;
    delete (updateData as any).email;
    delete (updateData as any).password;

    // Ensure preferences is properly typed
    const setData: any = {
      ...updateData,
      updatedAt: new Date(),
    };

    // Handle preferences separately if it exists
    if (updateData.preferences) {
      setData.preferences = updateData.preferences;
    }

    const updatedUser = await db
      .update(users)
      .set(setData)
      .where(eq(users.id, req.user!.id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        avatar: users.avatar,
        college: users.college,
        city: users.city,
        bio: users.bio,
        skills: users.skills,
        preferences: users.preferences,
        onboardingCompleted: users.onboardingCompleted,
      });

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser[0],
    });
  } catch (error) {
    console.error('Update profile error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;