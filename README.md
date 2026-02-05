# BuilderSpace 🚀

A modern platform connecting startup founders with talented builders and facilitating hackathon collaborations.

## 🌟 Features

### For Founders & Organizers
- **Create Startups**: Post your startup ideas and find co-founders
- **Organize Hackathons**: Host hackathons and build teams
- **Manage Applications**: Review and accept/reject applications
- **Dashboard**: Track your posts and manage received applications

### For Builders & Participants
- **Discover Opportunities**: Browse startups and hackathons
- **Apply to Join**: Submit applications with personalized messages
- **Track Applications**: Monitor your application status
- **Profile Management**: Showcase your skills and experience

### Core Functionality
- **Authentication**: Secure JWT-based auth with Google OAuth support
- **Real-time Updates**: Dynamic application status updates
- **Skill Matching**: Filter opportunities by required skills
- **Responsive Design**: Works seamlessly on desktop and mobile

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **React Router** for navigation
- **Shadcn/ui** for UI components

### Backend
- **Node.js** with Express
- **TypeScript** for type safety
- **PostgreSQL** database
- **Drizzle ORM** for database operations
- **JWT** for authentication
- **Google OAuth** integration
- **Helmet** for security
- **CORS** for cross-origin requests

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd builderspace
   ```

2. **Install dependencies**
   ```bash
   # Install frontend dependencies
   npm install
   
   # Install backend dependencies
   cd server
   npm install
   cd ..
   ```

3. **Set up the database**
   ```bash
   # Create PostgreSQL database
   createdb builderspace
   
   # Run database setup
   cd server
   psql -U postgres -d builderspace -f create-tables.sql
   ```

4. **Configure environment variables**
   ```bash
   # Copy environment files
   cp server/.env.example server/.env
   cp .env.example .env
   
   # Edit server/.env with your database credentials
   # Edit .env with your API URL (if different from default)
   ```

5. **Start the development servers**
   ```bash
   # Start backend server (in server directory)
   cd server
   npm run dev
   
   # Start frontend server (in root directory)
   cd ..
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - Health check: http://localhost:3001/health

## 📁 Project Structure

```
builderspace/
├── src/                    # Frontend source code
│   ├── components/         # Reusable UI components
│   ├── pages/             # Page components
│   ├── services/          # API service layer
│   ├── context/           # React context providers
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility functions
│   └── types/             # TypeScript type definitions
├── server/                # Backend source code
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   ├── db/            # Database schema and connection
│   │   ├── middleware/    # Express middleware
│   │   └── utils/         # Utility functions
│   ├── create-tables.sql  # Database schema
│   └── package.json       # Backend dependencies
├── public/                # Static assets
└── package.json           # Frontend dependencies
```

## 🗄️ Database Schema

### Core Tables
- **users**: User profiles and authentication
- **startups**: Startup posts and details
- **hackathons**: Hackathon events and information
- **applications**: User applications to startups/hackathons

### Key Features
- UUID primary keys for security
- JSONB fields for flexible skill storage
- Proper foreign key relationships
- Indexed columns for performance

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/google` - Google OAuth
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile

### Startups
- `GET /api/startups` - List startups
- `GET /api/startups/:id` - Get startup details
- `POST /api/startups` - Create startup
- `PUT /api/startups/:id` - Update startup
- `DELETE /api/startups/:id` - Delete startup

### Hackathons
- `GET /api/hackathons` - List hackathons
- `GET /api/hackathons/:id` - Get hackathon details
- `POST /api/hackathons` - Create hackathon
- `PUT /api/hackathons/:id` - Update hackathon
- `DELETE /api/hackathons/:id` - Delete hackathon

### Applications
- `POST /api/applications` - Submit application
- `GET /api/applications/my` - Get user's applications
- `GET /api/applications/received` - Get received applications
- `PUT /api/applications/:id/status` - Update application status

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting on API endpoints
- CORS configuration
- Helmet security headers
- Input validation with Zod
- SQL injection prevention with parameterized queries

## 🎨 UI/UX Features

- Modern dark theme design
- Responsive layout for all devices
- Smooth animations with Framer Motion
- Loading states and error handling
- Accessible components
- Intuitive navigation

## 🚀 Deployment

### Environment Variables
Make sure to set these in production:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Strong secret for JWT tokens
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `NODE_ENV`: Set to "production"

### Build Commands
```bash
# Build frontend
npm run build

# Build backend
cd server
npm run build
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with modern web technologies
- Inspired by the need for better startup-builder connections
- Designed for the developer community

---

**BuilderSpace** - Where ideas meet talent! 🚀✨