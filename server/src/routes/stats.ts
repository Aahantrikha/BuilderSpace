import express from 'express';
import { getStats } from '../utils/statsHelper.js';

const router = express.Router();

// Get platform statistics
router.get('/', async (req, res) => {
  try {
    const stats = await getStats();
    res.json({ stats });
  } catch (error) {
    console.error('Failed to get stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

export default router;
