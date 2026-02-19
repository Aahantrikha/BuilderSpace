import mongoose, { Schema, Document } from 'mongoose';

// User Interface
export interface IUser extends Document {
  email: string;
  name: string;
  password?: string;
  avatar?: string;
  college?: string;
  city?: string;
  bio?: string;
  skills: string[];
  preferences: {
    joinStartup: boolean;
    buildStartup: boolean;
    joinHackathons: boolean;
  };
  googleId?: string;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// User Schema
const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  password: { type: String },
  avatar: { type: String },
  college: { type: String, trim: true },
  city: { type: String, trim: true },
  bio: { type: String },
  skills: { type: [String], default: [] },
  preferences: {
    type: {
      joinStartup: { type: Boolean, default: false },
      buildStartup: { type: Boolean, default: false },
      joinHackathons: { type: Boolean, default: false },
    },
    default: {
      joinStartup: false,
      buildStartup: false,
      joinHackathons: false,
    },
  },
  googleId: { type: String, sparse: true, unique: true },
  emailVerified: { type: Boolean, default: false },
  onboardingCompleted: { type: Boolean, default: false },
}, {
  timestamps: true,
});

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ googleId: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);

// Startup Interface
export interface IStartup extends Document {
  founderId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  logo?: string;
  stage: 'Idea' | 'Prototype' | 'Launched';
  skillsNeeded: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Startup Schema
const StartupSchema = new Schema<IStartup>({
  founderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  logo: { type: String },
  stage: { type: String, enum: ['Idea', 'Prototype', 'Launched'], required: true },
  skillsNeeded: { type: [String], default: [] },
}, {
  timestamps: true,
});

// Indexes
StartupSchema.index({ founderId: 1 });
StartupSchema.index({ stage: 1 });
StartupSchema.index({ createdAt: -1 });

export const Startup = mongoose.model<IStartup>('Startup', StartupSchema);

// Hackathon Interface
export interface IHackathon extends Document {
  creatorId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  logo?: string;
  teamSize: number;
  deadline: Date;
  skillsNeeded: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Hackathon Schema
const HackathonSchema = new Schema<IHackathon>({
  creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  logo: { type: String },
  teamSize: { type: Number, required: true, min: 1, max: 20 },
  deadline: { type: Date, required: true },
  skillsNeeded: { type: [String], default: [] },
}, {
  timestamps: true,
});

// Indexes
HackathonSchema.index({ creatorId: 1 });
HackathonSchema.index({ deadline: 1 });
HackathonSchema.index({ createdAt: -1 });

export const Hackathon = mongoose.model<IHackathon>('Hackathon', HackathonSchema);

// Application Interface
export interface IApplication extends Document {
  applicantId: mongoose.Types.ObjectId;
  postType: 'startup' | 'hackathon';
  postId: mongoose.Types.ObjectId;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

// Application Schema
const ApplicationSchema = new Schema<IApplication>({
  applicantId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  postType: { type: String, enum: ['startup', 'hackathon'], required: true },
  postId: { type: Schema.Types.ObjectId, required: true, refPath: 'postType' },
  message: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
}, {
  timestamps: true,
});

// Indexes
ApplicationSchema.index({ applicantId: 1 });
ApplicationSchema.index({ postId: 1, postType: 1 });
ApplicationSchema.index({ status: 1 });
ApplicationSchema.index({ createdAt: -1 });

export const Application = mongoose.model<IApplication>('Application', ApplicationSchema);

// Screening Message Interface
export interface IScreeningMessage extends Document {
  applicationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

// Screening Message Schema
const ScreeningMessageSchema = new Schema<IScreeningMessage>({
  applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
}, {
  timestamps: true,
});

// Indexes
ScreeningMessageSchema.index({ applicationId: 1, createdAt: 1 });

export const ScreeningMessage = mongoose.model<IScreeningMessage>('ScreeningMessage', ScreeningMessageSchema);

// Team Member Interface
export interface ITeamMember extends Document {
  userId: mongoose.Types.ObjectId;
  postType: 'startup' | 'hackathon';
  postId: mongoose.Types.ObjectId;
  role: 'founder' | 'member';
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Team Member Schema
const TeamMemberSchema = new Schema<ITeamMember>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  postType: { type: String, enum: ['startup', 'hackathon'], required: true },
  postId: { type: Schema.Types.ObjectId, required: true },
  role: { type: String, enum: ['founder', 'member'], default: 'member' },
  joinedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// Indexes
TeamMemberSchema.index({ userId: 1 });
TeamMemberSchema.index({ postId: 1, postType: 1 });
TeamMemberSchema.index({ userId: 1, postId: 1, postType: 1 }, { unique: true });

export const TeamMember = mongoose.model<ITeamMember>('TeamMember', TeamMemberSchema);

// Team Space Interface
export interface ITeamSpace extends Document {
  postType: 'startup' | 'hackathon';
  postId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Team Space Schema
const TeamSpaceSchema = new Schema<ITeamSpace>({
  postType: { type: String, enum: ['startup', 'hackathon'], required: true },
  postId: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String },
}, {
  timestamps: true,
});

// Indexes
TeamSpaceSchema.index({ postId: 1, postType: 1 }, { unique: true });

export const TeamSpace = mongoose.model<ITeamSpace>('TeamSpace', TeamSpaceSchema);

// Space Message Interface
export interface ISpaceMessage extends Document {
  spaceId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

// Space Message Schema
const SpaceMessageSchema = new Schema<ISpaceMessage>({
  spaceId: { type: Schema.Types.ObjectId, ref: 'TeamSpace', required: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
}, {
  timestamps: true,
});

// Indexes
SpaceMessageSchema.index({ spaceId: 1, createdAt: 1 });

export const SpaceMessage = mongoose.model<ISpaceMessage>('SpaceMessage', SpaceMessageSchema);

// Space Link Interface
export interface ISpaceLink extends Document {
  spaceId: mongoose.Types.ObjectId;
  creatorId: mongoose.Types.ObjectId;
  title: string;
  url: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Space Link Schema
const SpaceLinkSchema = new Schema<ISpaceLink>({
  spaceId: { type: Schema.Types.ObjectId, ref: 'TeamSpace', required: true },
  creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  url: { type: String, required: true },
  description: { type: String },
}, {
  timestamps: true,
});

// Indexes
SpaceLinkSchema.index({ spaceId: 1, createdAt: -1 });

export const SpaceLink = mongoose.model<ISpaceLink>('SpaceLink', SpaceLinkSchema);

// Space Task Interface
export interface ISpaceTask extends Document {
  spaceId: mongoose.Types.ObjectId;
  creatorId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  completed: boolean;
  completedBy?: mongoose.Types.ObjectId;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Space Task Schema
const SpaceTaskSchema = new Schema<ISpaceTask>({
  spaceId: { type: Schema.Types.ObjectId, ref: 'TeamSpace', required: true },
  creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String },
  completed: { type: Boolean, default: false },
  completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  completedAt: { type: Date },
}, {
  timestamps: true,
});

// Indexes
SpaceTaskSchema.index({ spaceId: 1, completed: 1 });
SpaceTaskSchema.index({ spaceId: 1, createdAt: -1 });

export const SpaceTask = mongoose.model<ISpaceTask>('SpaceTask', SpaceTaskSchema);
