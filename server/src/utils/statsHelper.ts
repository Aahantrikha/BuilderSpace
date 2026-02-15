import { db } from '../db/index.js';
import { users, startups, hackathons, applications } from '../db/schema.js';
import { count } from 'drizzle-orm';
import { messageBroadcastService } from '../services/MessageBroadcastService.js';

/**
 * Get current platform statistics
 */
export async function getStats() {
  const [usersCount] = await db.select({ count: count() }).from(users);
  const [startupsCount] = await db.select({ count: count() }).from(startups);
  const [hackathonsCount] = await db.select({ count: count() }).from(hackathons);
  const [applicationsCount] = await db.select({ count: count() }).from(applications);

  return {
    users: usersCount.count,
    startups: startupsCount.count,
    hackathons: hackathonsCount.count,
    applications: applicationsCount.count,
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
