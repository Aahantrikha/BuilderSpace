# BuilderSpace Backend

Production-ready backend API for BuilderSpace - A student collaboration platform for startups and hackathons.

## Features

- 🔐 **JWT Authentication** - Secure token-based authentication
- 🌐 **Google OAuth** - Sign in with Google integration
- 📧 **Email/Password Auth** - Traditional authentication with bcrypt
- 🗄️ **PostgreSQL Database** - Robust data storage with Drizzle ORM
- 🛡️ **Security** - Rate limiting, CORS, helmet, input validation
- 📝 **TypeScript** - Full type safety
- 🚀 **Production Ready** - Error handling, logging, environment configs

## Tech Stack

- **Node.js** + **Express** - Server framework
- **TypeScript** - Type safety
- **Drizzle ORM** - Database ORM
- **PostgreSQL** - Database
- **JWT** - Authentication tokens
- **Google OAuth** - Social login
- **Zod** - Input validation
- **bcryptjs** - Password hashing

## Quick Start

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Database Setup

Install PostgreSQL and create a database:

```sql
CREATE DATABASE builderspace;
```

### 3. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret

### 4. Database Migration

Generate and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

### 5. Start Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:3001`

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account with email/password
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/google` - Login with Google OAuth
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile

### Startups
- `GET /api/startups` - List startups (with search/filter)
- `GET /api/startups/:id` - Get startup details
- `POST /api/startups` - Create new startup
- `PUT /api/startups/:id` - Update startup (founder only)
- `DELETE /api/startups/:id` - Delete startup (founder only)

### Hackathons
- `GET /api/hackathons` - List hackathons (with search/filter)
- `GET /api/hackathons/:id` - Get hackathon details
- `POST /api/hackathons` - Create new hackathon
- `PUT /api/hackathons/:id` - Update hackathon (creator only)
- `DELETE /api/hackathons/:id` - Delete hackathon (creator only)

### Applications
- `POST /api/applications` - Apply to startup/hackathon
- `GET /api/applications/my` - Get user's applications
- `GET /api/applications/received` - Get applications for user's posts
- `PUT /api/applications/:id/status` - Accept/reject application

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:5173` (development)
   - Your production domain
6. Copy Client ID and Secret to `.env`

## Database Schema

The database includes these main tables:
- `users` - User profiles and authentication
- `startups` - Startup posts
- `hackathons` - Hackathon posts
- `applications` - Applications to join startups/hackathons
- `email_verification_tokens` - Email verification (future feature)

## Security Features

- **Rate Limiting** - Prevents abuse
- **CORS** - Cross-origin request security
- **Helmet** - Security headers
- **Input Validation** - Zod schema validation
- **Password Hashing** - bcrypt with salt rounds
- **JWT Tokens** - Secure authentication
- **SQL Injection Protection** - Drizzle ORM parameterized queries

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:generate` - Generate database migrations
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Drizzle Studio (database GUI)

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a secure `JWT_SECRET`
3. Configure production database
4. Set up proper CORS origins
5. Use HTTPS in production
6. Configure environment variables on your hosting platform

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/builderspace"

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