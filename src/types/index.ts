export type User = {
  user_id: string;
  name: string;
  email: string;
  college: string;
  city: string;
  skills: string[];
  bio: string;
  preferences: {
    joinStartup: boolean;
    buildStartup: boolean;
    joinHackathons: boolean;
  };
  created_at: Date;
}

export type Startup = {
  startup_id: string;
  founder_id: string;
  founder_name: string;
  founder_avatar?: string;
  startup_name: string;
  description: string;
  stage: 'Idea' | 'Prototype' | 'Launched';
  skills_needed: string[];
  created_at: Date;
}

export type Hackathon = {
  hackathon_id: string;
  creator_id: string;
  creator_name: string;
  creator_avatar?: string;
  hackathon_name: string;
  description: string;
  team_size: number;
  deadline: Date;
  skills_needed: string[];
  created_at: Date;
}

export type Application = {
  application_id: string;
  applicant_id: string;
  post_type: 'startup' | 'hackathon';
  post_id: string;
  post_name: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: Date;
}
