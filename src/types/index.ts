export type User = {
  id: string;
  name: string;
  email: string;
  college?: string;
  city?: string;
  skills: string[];
  bio?: string;
  avatar?: string;
  preferences: {
    joinStartup: boolean;
    buildStartup: boolean;
    joinHackathons: boolean;
  };
  onboardingCompleted?: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export type Startup = {
  id: string;
  founderId: string;
  name: string;
  description: string;
  stage: 'Idea' | 'Prototype' | 'Launched';
  skillsNeeded: string[];
  createdAt: Date;
  founder?: {
    id: string;
    name: string;
    avatar?: string;
    college?: string;
    city?: string;
    bio?: string;
  };
}

export type Hackathon = {
  id: string;
  creatorId: string;
  name: string;
  description: string;
  teamSize: number;
  deadline: Date;
  skillsNeeded: string[];
  createdAt: Date;
  creator?: {
    id: string;
    name: string;
    avatar?: string;
    college?: string;
    city?: string;
    bio?: string;
  };
}

export type Application = {
  id: string;
  applicantId: string;
  postType: 'startup' | 'hackathon';
  postId: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  applicant?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    college?: string;
    city?: string;
    skills?: string[];
  };
  post?: {
    id: string;
    name: string;
    stage?: string;
    deadline?: Date;
  };
}

export type ScreeningMessage = {
  id: string;
  applicationId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  sender?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export type TeamMember = {
  id: string;
  userId: string;
  postType: 'startup' | 'hackathon';
  postId: string;
  role: 'founder' | 'member';
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    college?: string;
    city?: string;
    skills?: string[];
  };
}

export type TeamSpace = {
  id: string;
  postType: 'startup' | 'hackathon';
  postId: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  post?: {
    id: string;
    name: string;
    stage?: string;
    deadline?: Date;
  };
}

export type SpaceMessage = {
  id: string;
  spaceId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  sender?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export type SpaceLink = {
  id: string;
  spaceId: string;
  creatorId: string;
  title: string;
  url: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  creator?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export type SpaceTask = {
  id: string;
  spaceId: string;
  creatorId: string;
  title: string;
  description?: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  creator?: {
    id: string;
    name: string;
    avatar?: string;
  };
  completedByUser?: {
    id: string;
    name: string;
    avatar?: string;
  };
}