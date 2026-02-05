# BuilderSpace - Production Setup Guide

This guide will help you set up BuilderSpace with a production-ready backend including real authentication, Google OAuth, and database integration.

## 🚀 What's New

Your BuilderSpace app now has:
- ✅ **Real Authentication** - JWT-based auth with secure password hashing
- ✅ **Google OAuth** - Sign in with Google integration
- ✅ **PostgreSQL Database** - Production-ready data storage
- ✅ **API Backend** - RESTful API with Express.js
- ✅ **Security Features** - Rate limiting, CORS, input validation
- ✅ **TypeScript** - Full type safety on frontend and backend

## 📋 Prerequisites

1. **Node.js** (v18 or higher)
2. **PostgreSQL** (v13 or higher)
3. **Google Cloud Account** (for OAuth)

## 🛠️ Setup Instructions

### Step 1: Database Setup

1. **Install PostgreSQL** (if not already installed):
   - Windows: Download from [postgresql.org](https://www.postgresql.org/download/windows/)
   - macOS: `brew install postgresql`
   - Linux: `sudo apt-get install postgresql`

2. **Create Database**:
   ```sql
   -- Connect to PostgreSQL as superuser
   psql -U postgres
   
   -- Create database and user
   CREATE DATABASE builderspace;
   CREATE USER builderspace_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE builderspace TO builderspace_user;
   ```

### Step 2: Google OAuth Setup

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create a new project** or select existing one
3. **Enable APIs**:
   - Go to "APIs & Services" > "Library"
   - Search and enable "Google+ API"
4. **Create OAuth Credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Application type: "Web application"
   - Authorized JavaScript origins: `http://localhost:5173`
   - Authorized redirect URIs: `http://localhost:5173/auth/google/callback`
5. **Copy your Client ID and Secret**

### Step 3: Backend Setup

1. **Install backend dependencies**:
   ```bash
   cd server
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `server/.env`:
   ```env
   DATABASE_URL="postgresql://builderspace_user:your_secure_password@localhost:5432/builderspace"
   JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
   GOOGLE_CLIENT_ID="your-google-client-id-from-step-2"
   GOOGLE_CLIENT_SECRET="your-google-client-secret-from-step-2"
   PORT=3001
   NODE_ENV="development"
   FRONTEND_URL="http://localhost:5173"
   ```

3. **Generate and run database migrations**:
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

4. **Start the backend server**:
   ```bash
   npm run dev
   ```
   
   Backend will run on `http://localhost:3001`

### Step 4: Frontend Setup

1. **Configure frontend environment**:
   ```bash
   # In the root directory
   cp .env.example .env
   ```
   
   Edit `.env`:
   ```env
   VITE_API_URL=http://localhost:3001/api
   VITE_GOOGLE_CLIENT_ID=your-google-client-id-from-step-2
   ```

2. **Install frontend dependencies** (if not already done):
   ```bash
   npm install
   ```

3. **Start the frontend** (if not already running):
   ```bash
   npm run dev
   ```

### Step 5: Add Google Sign-In Script

Add this to your `index.html` (already included):
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

## 🧪 Testing the Setup

1. **Visit** `http://localhost:5173`
2. **Click "Sign In"** - you should see the new auth page
3. **Try Email Signup**:
   - Click "Don't have an account? Sign up"
   - Fill in name, email, password
   - Should create account and redirect to onboarding
4. **Try Google OAuth**:
   - Click "Sign in with Google"
   - Should open Google sign-in popup
   - After authorization, should create/login user

## 🔧 API Testing

Test your API endpoints:

```bash
# Health check
curl http://localhost:3001/health

# Create account
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## 🗄️ Database Management

**View your data** with Drizzle Studio:
```bash
cd server
npm run db:studio
```

This opens a web interface at `http://localhost:4983` to view and edit your database.

## 🔒 Security Notes

1. **Change JWT_SECRET** in production to a long, random string
2. **Use HTTPS** in production
3. **Set secure CORS origins** for production
4. **Use environment variables** for all secrets
5. **Enable database SSL** in production

## 🚀 Production Deployment

### Backend Deployment (e.g., Railway, Heroku, DigitalOcean)

1. **Set environment variables** on your hosting platform
2. **Deploy backend** with production database URL
3. **Update FRONTEND_URL** to your production domain

### Frontend Deployment (e.g., Vercel, Netlify)

1. **Update VITE_API_URL** to your production backend URL
2. **Update Google OAuth** redirect URIs to production domain
3. **Deploy frontend**

## 🆘 Troubleshooting

### Database Connection Issues
- Check PostgreSQL is running: `pg_ctl status`
- Verify database exists: `psql -U postgres -l`
- Check connection string format

### Google OAuth Issues
- Verify Client ID in both backend and frontend `.env`
- Check authorized origins in Google Cloud Console
- Ensure Google+ API is enabled

### CORS Issues
- Check `FRONTEND_URL` in backend `.env`
- Verify frontend is running on correct port

### Authentication Issues
- Check JWT_SECRET is set
- Verify API endpoints are accessible
- Check browser network tab for API errors

## 📚 Next Steps

Now that you have production-ready authentication:

1. **Customize user profiles** in the onboarding flow
2. **Add real startup/hackathon data** through the API
3. **Implement email verification** (optional)
4. **Add file upload** for user avatars
5. **Set up production deployment**

Your BuilderSpace app is now ready for real users! 🎉