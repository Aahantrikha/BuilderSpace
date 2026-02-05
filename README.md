# BuilderSpace

A platform for student builders to find co-founders, recruit hackathon teams, and collaborate on projects.

## 🚀 Features

- **Find Co-Founders**: Browse startups and join as a team member
- **Recruit Hackathon Teams**: Create posts to recruit teammates for hackathons
- **Join Hackathon Teams**: Browse and apply to join existing hackathon teams
- **Team Workspaces**: Auto-created collaboration spaces with chat, links, and tasks
- **Screening Chats**: Private 1-on-1 chat between founders and applicants
- **Application System**: Apply to join teams, founders can accept/reject

## 📋 Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS + shadcn/ui components
- React Router for navigation
- Framer Motion for animations

### Backend
- Node.js + Express
- TypeScript
- SQLite database (via Drizzle ORM)
- JWT authentication
- WebSocket server (Socket.io)
- Bcrypt for password hashing

### Testing
- Vitest (unit tests)
- fast-check (property-based testing)
- 478+ tests passing

## 🛠️ Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Aahantrikha/BuilderSpace.git
   cd BuilderSpace/app
   ```

2. **Install dependencies**
   ```bash
   # Install frontend dependencies
   npm install

   # Install backend dependencies
   cd server
   npm install
   ```

3. **Setup environment variables**
   ```bash
   # Frontend (.env in app/)
   cp .env.example .env
   # Add your environment variables

   # Backend (.env in app/server/)
   cd server
   cp .env.example .env
   # Add your environment variables (JWT_SECRET, GOOGLE_CLIENT_ID, etc.)
   ```

4. **Initialize database**
   ```bash
   cd server
   npm run setup-db
   ```

5. **Start development servers**
   ```bash
   # Terminal 1: Start backend (from app/server/)
   cd server
   npm run dev

   # Terminal 2: Start frontend (from app/)
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - Health Check: http://localhost:3001/health

## 📚 Documentation

- [Quick Start Guide](server/QUICK_START.md) - Get started quickly
- [API Endpoints](server/API_ENDPOINTS.md) - Complete API documentation
- [Testing Guide](server/TESTING_GUIDE.md) - How to run and write tests
- [Implementation Summary](server/IMPLEMENTATION_SUMMARY.md) - Technical details
- [Setup Guide](SETUP.md) - Detailed setup instructions

## 🏗️ Project Structure

```
app/
├── src/                    # Frontend source code
│   ├── components/        # Reusable UI components
│   ├── pages/            # Route pages
│   ├── services/         # API client
│   ├── context/          # React context (auth)
│   └── types/            # TypeScript types
├── server/               # Backend source code
│   ├── src/
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic
│   │   ├── middleware/  # Express middleware
│   │   ├── db/          # Database schema & setup
│   │   └── utils/       # Utility functions
│   └── builderspace.db  # SQLite database (gitignored)
└── README.md            # This file
```

## 🧪 Testing

```bash
# Run all tests
cd server
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- BuilderSpaceService.test.ts
```

## 🔑 Key Features Explained

### Automatic Workspace Creation
When you create a startup or hackathon, a workspace is automatically created:
- Creator is added as the founder
- Workspace includes group chat, shared links, and task management

### Application Flow
1. User applies to join a startup/hackathon
2. Founder reviews application on dashboard
3. Founder accepts/rejects application
4. If accepted:
   - Screening chat is created (1-on-1)
   - Applicant is added to team workspace
   - Both can collaborate

### Team Collaboration
- **Group Chat**: All team members can send messages
- **Shared Links**: Share important resources
- **Task Management**: Create and track tasks

## 🚢 Deployment

### Frontend (Vercel/Netlify)
```bash
npm run build
# Deploy the dist/ folder
```

### Backend (Railway/Render/Heroku)
```bash
cd server
npm run build
# Deploy with start command: npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 👥 Authors

- Aahan Trikha - [@Aahantrikha](https://github.com/Aahantrikha)

## 🙏 Acknowledgments

- Built with [Vite](https://vitejs.dev/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
- Testing with [Vitest](https://vitest.dev/) and [fast-check](https://fast-check.dev/)
