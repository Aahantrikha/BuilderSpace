import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { teamFormationService } from '../services/TeamFormationService.js';
import { Application, Startup, Hackathon } from '../db/index.js';

const router = Router();

// Invite applicant to Builder Space (team formation)
router.post('/applications/:id/invite', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const founderId = req.user!.id;

    // Get application details
    const application = await Application.findById(id);

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Check if application is accepted
    if (application.status !== 'accepted') {
      return res.status(400).json({ error: 'Application must be accepted before inviting to team' });
    }

    // Check if user owns the post
    let isOwner = false;
    if (application.postType === 'startup') {
      const startup = await Startup.findById(application.postId);
      isOwner = startup && startup.founderId.toString() === founderId;
    } else {
      const hackathon = await Hackathon.findById(application.postId);
      isOwner = hackathon && hackathon.creatorId.toString() === founderId;
    }

    if (!isOwner) {
      return res.status(403).json({ error: 'You can only invite applicants to your own posts' });
    }

    // Invite to Builder Space
    const result = await teamFormationService.inviteToBuilderSpace(id, founderId);

    res.status(201).json({
      message: 'Applicant invited to Builder Space successfully',
      teamMember: result.teamMember,
      builderSpace: result.builderSpace,
    });
  } catch (error: any) {
    console.error('Invite to Builder Space error:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('already a member')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes('not accepted')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get team members for a post
router.get('/:postType/:postId/members', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { postType, postId } = req.params;
    const userId = req.user!.id;

    // Validate post type
    if (postType !== 'startup' && postType !== 'hackathon') {
      return res.status(400).json({ error: 'Invalid post type' });
    }

    // Check if user owns the post or is a team member
    let isAuthorized = false;
    if (postType === 'startup') {
      const startup = await Startup.findById(postId);

      if (!startup) {
        return res.status(404).json({ error: 'Startup not found' });
      }

      isAuthorized = startup.founderId.toString() === userId;
    } else {
      const hackathon = await Hackathon.findById(postId);

      if (!hackathon) {
        return res.status(404).json({ error: 'Hackathon not found' });
      }

      isAuthorized = hackathon.creatorId.toString() === userId;
    }

    // If not owner, check if user is a team member
    if (!isAuthorized) {
      const members = await teamFormationService.getTeamMembers(postType, postId);
      isAuthorized = members.some(m => m.userId === userId);
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: 'You are not authorized to view this team' });
    }

    // Get team members
    const members = await teamFormationService.getTeamMembers(postType, postId);

    res.json({ members });
  } catch (error: any) {
    console.error('Get team members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
