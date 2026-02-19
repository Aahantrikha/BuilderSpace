import { User, Startup, Hackathon, Application } from '../db/index.js';
import { messageBroadcastService } from '../services/MessageBroadcastService.js';

/**
 * Get current platform statistics
 */
export async function getStats() {
  const [usersCount, startupsCount, hackathonsCount, applicationsCount] = await Promise.all([
    User.countDocuments(),
    Startup.countDocuments(),
    Hackathon.countDocuments(),
    Application.countDocuments(),
  ]);

  return {
    users: usersCount,
    startups: startupsCount,
    hackathons: hackathonsCount,
    applications: applicationsCount,
  };
}

/**
 * Broadcast stats update to all connected users
 */
export async function broadcastStatsUpdate() {
  try {
    const stats = await getStats();
    messageBroadcastService.broadcastStatsUpdate(stats);
  } catch (error) {
    console.error('Failed to broadcast stats update:', error);
  }
}