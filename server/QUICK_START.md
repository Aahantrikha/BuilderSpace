# Quick Start Guide - Team Collaboration Workspace

## 🚀 Get Started in 3 Steps

### Step 1: Setup Database
```bash
cd app/server
npm run db:create
```

This creates all the necessary tables including the new collaboration tables.

### Step 2: Start the Server
```bash
npm run dev
```

You should see:
```
🚀 BuilderSpace API server running on port 3001
📱 Frontend URL: http://localhost:5173
🌍 Environment: development
📊 Health check: http://localhost:3001/health
🔌 WebSocket server ready
```

### Step 3: Test the API
Open a new terminal and test the health endpoint:
```bash
curl http://localhost:3001/health
```

## 🧪 Quick Test Workflow

### 1. Create Test Users
You'll need at least 2 users:
- User A (Founder)
- User B (Applicant)

Use the existing auth endpoints to create users and get JWT tokens.

### 2. Test Screening Chat Flow

**Step 1:** User A creates a startup/hackathon post
```bash
POST /api/startups
# or
POST /api/hackathons
```

**Step 2:** User B applies to the post
```bash
POST /api/applications
{
  "postType": "startup",
  "postId": "uuid",
  "message": "I'd love to join!"
}
```

**Step 3:** User A accepts the application
```bash
PUT /api/applications/:applicationId/status
{
  "status": "accepted"
}
```
✅ This automatically creates a screening chat!

**Step 4:** Both users can now message each other
```bash
# Send message
POST /api/screening-chats/:chatId/messages
{
  "content": "Hello! Let's discuss the project."
}

# Get messages
GET /api/screening-chats/:chatId/messages
```

### 3. Test Team Formation

**Step 1:** User A invites User B to Builder Space
```bash
POST /api/teams/applications/:applicationId/invite
```
✅ This creates a team member and Builder Space!

**Step 2:** Both users can now access the Builder Space
```bash
GET /api/builder-spaces/:spaceId
```

### 4. Test Builder Space Features

**Group Chat:**
```bash
# Send group message
POST /api/builder-spaces/:spaceId/messages
{
  "content": "Welcome to the team!"
}

# Get messages
GET /api/builder-spaces/:spaceId/messages
```

**Shared Links:**
```bash
# Add link
POST /api/builder-spaces/:spaceId/links
{
  "title": "GitHub Repo",
  "url": "https://github.com/team/project"
}

# Get links
GET /api/builder-spaces/:spaceId/links
```

**Tasks:**
```bash
# Create task
POST /api/builder-spaces/:spaceId/tasks
{
  "title": "Setup database",
  "description": "Create initial schema"
}

# Get tasks
GET /api/builder-spaces/:spaceId/tasks

# Mark complete
PUT /api/builder-spaces/:spaceId/tasks/:taskId
{
  "completed": true
}
```

### 5. Test WebSocket (Real-time)

**JavaScript Example:**
```javascript
const ws = new WebSocket('ws://localhost:3001?userId=YOUR_USER_ID');

ws.onopen = () => {
  console.log('Connected to WebSocket');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received notification:', data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

**What you'll receive:**
- New screening messages
- New group messages
- Links added/removed
- Tasks created/updated/deleted
- Team invitations

## 📋 Useful Commands

### Run Tests
```bash
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:ui         # UI mode
```

### Database
```bash
npm run db:create       # Create tables
npm run db:studio       # Open Drizzle Studio
```

### Development
```bash
npm run dev            # Start dev server
npm run build          # Build for production
npm start              # Start production server
```

## 🔍 Verify Everything Works

### Check Database Tables
```bash
npm run db:studio
```

Look for these new tables:
- screening_messages
- team_members
- team_spaces
- space_messages
- space_links
- space_tasks

### Check API Endpoints
```bash
# Health check
curl http://localhost:3001/health

# Should return:
# {"status":"OK","timestamp":"...","environment":"development"}
```

### Check Tests
```bash
npm test

# Should show:
# Test Files  10 passed (10)
# Tests  334 passed (334)
```

## 🎯 Testing Checklist

- [ ] Database tables created
- [ ] Server starts without errors
- [ ] All 334 tests pass
- [ ] Health endpoint responds
- [ ] Can create screening chat
- [ ] Can send screening messages
- [ ] Can invite to Builder Space
- [ ] Can send group messages
- [ ] Can add shared links
- [ ] Can create tasks
- [ ] WebSocket connects successfully
- [ ] Real-time notifications work

## 🐛 Troubleshooting

### Server won't start
```bash
# Check if port 3001 is in use
netstat -ano | findstr :3001

# Kill the process or change port in .env
PORT=3002
```

### Database errors
```bash
# Reset database
rm builderspace.db
npm run db:create
```

### Tests failing
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
npm test
```

### WebSocket not connecting
- Ensure server is running
- Check userId is passed as query parameter
- Verify JWT token is valid
- Check browser console for errors

## 📚 Documentation

- **API Endpoints:** See `API_ENDPOINTS.md`
- **Testing Guide:** See `TESTING_GUIDE.md`
- **Implementation Summary:** See `IMPLEMENTATION_SUMMARY.md`

## ✅ Success!

If you can complete the testing checklist above, everything is working correctly!

You now have a fully functional team collaboration system with:
- ✅ Screening chats
- ✅ Team formation
- ✅ Builder Spaces
- ✅ Group messaging
- ✅ Shared links
- ✅ Task management
- ✅ Real-time notifications

Happy building! 🎉
