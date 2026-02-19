import { Router } from 'express';
import { z } from 'zod';
import { User } from '../db/index.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateTokens } from '../utils/jwt.js';
import { verifyGoogleToken, getGoogleAuthUrl } from '../utils/google-auth.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { broadcastStatsUpdate } from '../utils/statsHelper.js';

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
    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      emailVerified: false,
      onboardingCompleted: false,
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(newUser._id.toString(), newUser.email);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Broadcast stats update to all connected users
    broadcastStatsUpdate();

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        avatar: newUser.avatar,
        onboardingCompleted: newUser.onboardingCompleted,
      },
      accessToken,
    });
  } catch (error) {
    console.error('Signup error:', error instanceof Error ? error.message : 'Unknown error');
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
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id.toString(), user.email);

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
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        college: user.college,
        city: user.city,
        bio: user.bio,
        skills: user.skills,
        preferences: user.preferences,
        onboardingCompleted: user.onboardingCompleted,
      },
      accessToken,
    });
  } catch (error) {
    console.error('Login error:', error instanceof Error ? error.message : 'Unknown error');
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

    // Check if user exists by email or googleId
    let user = await User.findOne({
      $or: [
        { email: googleUser.email.toLowerCase() },
        { googleId: googleUser.googleId }
      ]
    });

    if (!user) {
      // Create new user
      user = await User.create({
        name: googleUser.name,
        email: googleUser.email.toLowerCase(),
        googleId: googleUser.googleId,
        avatar: googleUser.avatar,
        emailVerified: googleUser.emailVerified,
        onboardingCompleted: false,
      });
      
      // Broadcast stats update for new user
      broadcastStatsUpdate();
    } else {
      // Update existing user with Google info if not set
      if (!user.googleId) {
        user.googleId = googleUser.googleId;
        user.avatar = googleUser.avatar || user.avatar;
        user.emailVerified = googleUser.emailVerified || user.emailVerified;
        await user.save();
      }
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id.toString(), user.email);

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
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        college: user.college,
        city: user.city,
        bio: user.bio,
        skills: user.skills,
        preferences: user.preferences,
        onboardingCompleted: user.onboardingCompleted,
      },
      accessToken,
    });
  } catch (error) {
    console.error('Google auth error:', error instanceof Error ? error.message : 'Unknown error');
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
    console.error('Google auth URL error:', error instanceof Error ? error.message : 'Unknown error');
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
    const user = await User.findById(req.user!.id).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        college: user.college,
        city: user.city,
        bio: user.bio,
        skills: user.skills,
        preferences: user.preferences,
        onboardingCompleted: user.onboardingCompleted,
        createdAt: user.createdAt,
      }
    });
  } catch (error) {
    console.error('Get user error:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Remove fields that shouldn't be updated
    const updateData = { ...req.body };
    delete updateData.id;
    delete updateData._id;
    delete updateData.email;
    delete updateData.password;
    delete updateData.googleId;

    const updatedUser = await User.findByIdAndUpdate(
      req.user!.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id.toString(),
        name: updatedUser.name,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        college: updatedUser.college,
        city: updatedUser.city,
        bio: updatedUser.bio,
        skills: updatedUser.skills,
        preferences: updatedUser.preferences,
        onboardingCompleted: updatedUser.onboardingCompleted,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
