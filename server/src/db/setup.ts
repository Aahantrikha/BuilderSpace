import { db } from './index.js';
import { users, startups, hackathons, applications, emailVerificationTokens } from './schema.js';
import { hashPassword } from '../utils/password.js';

async function setupDatabase() {
  console.log('Setting up SQLite database...');
  
  try {
    // Create a demo user
    const hashedPassword = await hashPassword('demo123');
    
    const demoUser = await db.insert(users).values({
      email: 'demo@builderspace.com',
      name: 'Demo User',
      password: hashedPassword,
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      college: 'Demo University',
      city: 'San Francisco',
      bio: 'Passionate about building innovative solutions and connecting with fellow builders.',
      skills: ['React', 'Node.js', 'TypeScript', 'Python', 'UI/UX Design'],
      preferences: {
        joinStartup: true,
        buildStartup: true,
        joinHackathons: true,
      },
      emailVerified: true,
      onboardingCompleted: true,
    }).returning();

    console.log('Demo user created:', demoUser[0].email);

    // Create a sample startup
    const sampleStartup = await db.insert(startups).values({
      founderId: demoUser[0].id,
      name: 'EcoTrack',
      description: 'A sustainability tracking app that helps users monitor their carbon footprint and make eco-friendly choices. Join us in building a greener future!',
      stage: 'Prototype',
      skillsNeeded: ['React Native', 'UI/UX Design', 'Data Science', 'Environmental Science'],
    }).returning();

    console.log('Sample startup created:', sampleStartup[0].name);

    // Create a sample hackathon
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    const sampleHackathon = await db.insert(hackathons).values({
      creatorId: demoUser[0].id,
      name: 'Climate Change Hackathon 2024',
      description: 'Build innovative solutions to combat climate change and promote sustainability. 48-hour hackathon with amazing prizes and mentorship from industry experts!',
      teamSize: 4,
      deadline: futureDate,
      skillsNeeded: ['Full Stack Development', 'Machine Learning', 'Mobile Development', 'Data Visualization'],
    }).returning();

    console.log('Sample hackathon created:', sampleHackathon[0].name);

    console.log('Database setup completed successfully!');
  } catch (error) {
    console.error('Database setup failed:', error);
    throw error;
  }
}

// Run setup if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { setupDatabase };