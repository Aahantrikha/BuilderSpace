-- BuilderSpace Database Schema
-- Run this to create all tables

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    password TEXT,
    avatar TEXT,
    college VARCHAR(255),
    city VARCHAR(255),
    bio TEXT,
    skills JSONB DEFAULT '[]'::jsonb,
    preferences JSONB DEFAULT '{"joinStartup": false, "buildStartup": false, "joinHackathons": false}'::jsonb,
    google_id VARCHAR(255),
    email_verified BOOLEAN DEFAULT false,
    onboarding_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Startups table
CREATE TABLE IF NOT EXISTS startups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    founder_id UUID REFERENCES users(id) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    stage VARCHAR(50) NOT NULL CHECK (stage IN ('Idea', 'Prototype', 'Launched')),
    skills_needed JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Hackathons table
CREATE TABLE IF NOT EXISTS hackathons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES users(id) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    team_size INTEGER NOT NULL,
    deadline TIMESTAMP NOT NULL,
    skills_needed JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Applications table
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    applicant_id UUID REFERENCES users(id) NOT NULL,
    post_type VARCHAR(20) NOT NULL CHECK (post_type IN ('startup', 'hackathon')),
    post_id UUID NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Email verification tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_startups_founder_id ON startups(founder_id);
CREATE INDEX IF NOT EXISTS idx_hackathons_creator_id ON hackathons(creator_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant_id ON applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_post ON applications(post_type, post_id);

-- Insert a demo user for testing
INSERT INTO users (email, name, password, avatar, college, city, bio, skills, preferences, email_verified, onboarding_completed)
VALUES (
    'demo@builderspace.com',
    'Demo User',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSAg/9qm', -- password: demo123
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    'Demo University',
    'San Francisco',
    'Passionate about building innovative solutions and connecting with fellow builders.',
    '["React", "Node.js", "TypeScript", "Python", "UI/UX Design"]'::jsonb,
    '{"joinStartup": true, "buildStartup": true, "joinHackathons": true}'::jsonb,
    true,
    true
) ON CONFLICT (email) DO NOTHING;

-- Insert sample startup
INSERT INTO startups (founder_id, name, description, stage, skills_needed)
SELECT 
    u.id,
    'EcoTrack',
    'A sustainability tracking app that helps users monitor their carbon footprint and make eco-friendly choices. Join us in building a greener future!',
    'Prototype',
    '["React Native", "UI/UX Design", "Data Science", "Environmental Science"]'::jsonb
FROM users u 
WHERE u.email = 'demo@builderspace.com'
ON CONFLICT DO NOTHING;

-- Insert sample hackathon
INSERT INTO hackathons (creator_id, name, description, team_size, deadline, skills_needed)
SELECT 
    u.id,
    'Climate Change Hackathon 2024',
    'Build innovative solutions to combat climate change and promote sustainability. 48-hour hackathon with amazing prizes and mentorship from industry experts!',
    4,
    NOW() + INTERVAL '30 days',
    '["Full Stack Development", "Machine Learning", "Mobile Development", "Data Visualization"]'::jsonb
FROM users u 
WHERE u.email = 'demo@builderspace.com'
ON CONFLICT DO NOTHING;

COMMIT;