import { Router } from 'express';
import multer from 'multer';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { uploadAvatar, deleteAvatar, isSupabaseConfigured } from '../utils/supabase-storage.js';
import { User } from '../db/index.js';

const router = Router();

// Extend AuthRequest to include multer file
interface AuthRequestWithFile extends AuthRequest {
  file?: any;
}

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Upload avatar
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req: AuthRequestWithFile, res) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.status(503).json({ 
        error: 'File upload service is not configured. Please contact support.' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get current user
    const user = await User.findById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete old avatar if it exists and is from Supabase
    if (user.avatar && user.avatar.includes('supabase')) {
      await deleteAvatar(user.avatar);
    }

    // Upload new avatar
    const avatarUrl = await uploadAvatar(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    // Update user with new avatar URL
    user.avatar = avatarUrl;
    await user.save();

    res.json({
      message: 'Avatar uploaded successfully',
      avatarUrl,
    });
  } catch (error: any) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to upload avatar' 
    });
  }
});

// Delete avatar
router.delete('/avatar', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete avatar from Supabase if it exists
    if (user.avatar && user.avatar.includes('supabase')) {
      await deleteAvatar(user.avatar);
    }

    // Remove avatar from user
    user.avatar = undefined;
    await user.save();

    res.json({ message: 'Avatar deleted successfully' });
  } catch (error: any) {
    console.error('Avatar delete error:', error);
    res.status(500).json({ error: 'Failed to delete avatar' });
  }
});

export default router;
