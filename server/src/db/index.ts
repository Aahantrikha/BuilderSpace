// Export database connection
export { connectDB } from './connection.js';

// Export all models
export {
  User,
  Startup,
  Hackathon,
  Application,
  ScreeningMessage,
  TeamMember,
  TeamSpace,
  SpaceMessage,
  SpaceLink,
  SpaceTask,
} from './models.js';

// Export interfaces
export type {
  IUser,
  IStartup,
  IHackathon,
  IApplication,
  IScreeningMessage,
  ITeamMember,
  ITeamSpace,
  ISpaceMessage,
  ISpaceLink,
  ISpaceTask,
} from './models.js';

// Export validation schemas
export * from './validation.js';
