# CodeJam - Student Collaboration Platform 🚀

A modern platform connecting students for startups, hackathons, and collaborative projects.

## 🎯 Features

### Core Features
- **User Authentication** - Email/password + Google OAuth
- **Startups** - Post and discover startup opportunities
- **Hackathons** - Create and join hackathon teams
- **Applications** - Apply to opportunities with custom messages
- **Team Formation** - Accept applicants and build teams
- **Real-time Stats** - Live platform statistics

### Workspace Features
- **Builder Spaces** - Dedicated workspaces for each team
- **Group Chat** - Real-time team messaging
- **Screening Chats** - 1-on-1 founder-applicant conversations
- **Shared Links** - Organize important resources
- **Task Management** - Track team progress
- **WebSocket Updates** - Real-time synchronization

## 🛠️ Tech Stack

### Frontend
- React 19 + TypeScript
- Vite for build tooling
- TailwindCSS + shadcn/ui components
- React Router for navigation
- Framer Motion for animations
- WebSocket for real-time features

### Backend
- Node.js + Express
- TypeScript
- MongoDB Atlas + Mongoose
- JWT authentication
- WebSocket (ws library)
- Google OAuth 2.0

## 📁 Project Structure

```
codejam/
├── app/
│   ├── src/                    # Frontend source
│   │   ├── components/         # React components
│   │   ├── pages/              # Page components
│   │   ├── services/           # API services
│   │   ├── context/            # React context
│   │   ├── hooks/              # Custom hooks
│   │   └── types/              # TypeScript types
│   │
│   └── server/                 # Backend source
│       ├── src/
│       │   ├── routes/         # API routes (7 files)
│       │   ├── services/       # Business logic (10 files)
│       │   ├── middleware/     # Auth & error handling
│       │   ├── db/             # MongoDB models & connection
│       │   └── utils/          # Helper functions
│       │
│       ├── package.json
│       ├── tsconfig.json
│       └── vitest.config.ts
│
├── ARCHITECTURE.md             # System architecture
├── PROJECT_OVERVIEW.md         # Detailed documentation
├── FILE_STRUCTURE.md           # File organization
├── MIGRATION_COMPLETE.md       # MongoDB migration summary
├── READY_TO_DEPLOY.md          # Deployment guide
└── README.md                   # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- MongoDB Atlas account (free tier)
- Google OAuth credentials

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/codejam.git
cd codejam

# Install frontend dependencies
cd app
npm install

# Install backend dependencies
cd server
npm install
```

### 2. Configure Environment Variables

**Backend** (`app/server/.env`):
```env
# MongoDB
MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/codejam?retryWrites=true&w=majority"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Server
PORT=3001
NODE_ENV="development"
FRONTEND_URL="http://localhost:5173"
```

**Frontend** (`app/.env`):
```env
VITE_API_URL="http://localhost:3001/api"
VITE_GOOGLE_CLIENT_ID="your-google-client-id"
```

### 3. Run Development Servers

**Backend**:
```bash
cd app/server
npm run dev
```

**Frontend** (in a new terminal):
```bash
cd app
npm run dev
```

Visit http://localhost:5173 to see the app!

## 📦 Deployment

Deploy to Oracle Cloud Infrastructure (OCI) with custom domain support.

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for complete step-by-step instructions.

**What you'll get**:
- Frontend hosted on OCI with Nginx
- Backend hosted on OCI with PM2
- MongoDB Atlas (free tier)
- Custom domain with SSL (codejam.space)
- Total cost: ~$1.25/month (just the domain)

## 🧪 Testing

```bash
# Run all tests
cd app/server
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## 📚 Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide (OCI + custom domain)
- **README.md** - This file (project overview and quick start)

## 🔐 Security Features

- Bcrypt password hashing
- JWT token authentication
- HTTP-only cookies
- CORS configuration
- Rate limiting
- Input validation with Zod
- XSS protection with Helmet
- SQL injection prevention (MongoDB)

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/google` - Google OAuth
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Startups
- `GET /api/startups` - List all startups
- `POST /api/startups` - Create startup
- `GET /api/startups/:id` - Get startup details
- `PUT /api/startups/:id` - Update startup
- `DELETE /api/startups/:id` - Delete startup

### Hackathons
- `GET /api/hackathons` - List all hackathons
- `POST /api/hackathons` - Create hackathon
- `GET /api/hackathons/:id` - Get hackathon details
- `PUT /api/hackathons/:id` - Update hackathon
- `DELETE /api/hackathons/:id` - Delete hackathon

### Applications
- `POST /api/applications` - Apply to opportunity
- `GET /api/applications/my` - My applications
- `GET /api/applications/received/:postId` - Received applications
- `PUT /api/applications/:id/status` - Accept/reject

### Teams
- `POST /api/teams/invite` - Invite to team
- `GET /api/teams/:postType/:postId` - Get team members

### Builder Spaces
- `GET /api/spaces/:postType/:postId` - Get workspace
- `POST /api/spaces/:spaceId/messages` - Send message
- `POST /api/spaces/:spaceId/links` - Add link
- `POST /api/spaces/:spaceId/tasks` - Create task
- `PUT /api/spaces/tasks/:taskId` - Update task

### Stats
- `GET /api/stats` - Platform statistics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

- Check the documentation in the `/docs` folder
- Open an issue on GitHub
- Contact: your-email@example.com

## 🎉 Acknowledgments

- Built with React, Node.js, and MongoDB
- UI components from shadcn/ui
- Icons from Lucide React
- Deployed on Render and Vercel

---

**Ready to launch?** Follow the deployment guide in **[DEPLOYMENT.md](DEPLOYMENT.md)**! 🚀
