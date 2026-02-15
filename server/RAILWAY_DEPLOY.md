# CodeJam Backend - Railway Deployment Guide

## Quick Deploy (5 minutes)

### Step 1: Push to GitHub

```bash
# Initialize git in your project root (if not already done)
cd app
git init
git add .
git commit -m "Initial commit - CodeJam backend"

# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/codejam.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Railway

1. **Go to Railway**: https://railway.app
2. **Sign up** with GitHub
3. **Click "New Project"**
4. **Select "Deploy from GitHub repo"**
5. **Choose your codejam repository**
6. **Railway will auto-detect** it's a Node.js app
7. **Set Root Directory**: `app/server`

### Step 3: Add Environment Variables

In Railway dashboard, go to **Variables** tab and add:

```
NODE_ENV=production
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-this-to-something-random
GOOGLE_CLIENT_ID=826418995384-i8skr4dciv9n1fa8l0bpg8jcl3hjohjm.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
FRONTEND_URL=https://your-frontend-url.vercel.app
DATABASE_URL=file:./builderspace.db
JWT_EXPIRES_IN=7d
```

### Step 4: Configure Build Settings

Railway should auto-detect, but if needed:

**Build Command**: `npm run build`
**Start Command**: `npm start`
**Root Directory**: `app/server`

### Step 5: Add Railway Volume (for SQLite)

1. In Railway dashboard, go to **Settings**
2. Scroll to **Volumes**
3. Click **Add Volume**
4. **Mount Path**: `/app/data`
5. **Size**: 1GB

Then update your DATABASE_URL:
```
DATABASE_URL=file:/app/data/builderspace.db
```

### Step 6: Get Your Backend URL

After deployment, Railway gives you a URL like:
```
https://codejam-backend-production.up.railway.app
```

Copy this URL!

### Step 7: Update Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services > Credentials
3. Edit your OAuth client
4. Add to **Authorized JavaScript origins**:
   - `https://codejam-backend-production.up.railway.app`
   - `https://your-frontend-url.vercel.app`
5. Add to **Authorized redirect URIs**:
   - `https://your-frontend-url.vercel.app`

### Step 8: Deploy Frontend to Vercel

```bash
# In your project root
cd app
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: codejam
# - Directory: ./
# - Build command: npm run build
# - Output directory: dist
```

Add environment variables in Vercel:
```
VITE_API_URL=https://codejam-backend-production.up.railway.app/api
VITE_GOOGLE_CLIENT_ID=826418995384-i8skr4dciv9n1fa8l0bpg8jcl3hjohjm.apps.googleusercontent.com
```

## Troubleshooting

### Database not persisting?
- Make sure you added a Railway Volume
- Update DATABASE_URL to use the volume path: `file:/app/data/builderspace.db`

### CORS errors?
- Check FRONTEND_URL in Railway matches your Vercel URL
- Make sure both URLs are added to Google OAuth

### Build fails?
- Check Railway logs in the dashboard
- Ensure `npm run build` works locally first

### WebSocket not working?
- Railway supports WebSocket by default
- Make sure your frontend connects to `wss://` (secure WebSocket)

## Cost

- **Free tier**: $5/month credit (enough for small apps)
- **Hobby plan**: $5/month (if you exceed free tier)
- **Pro plan**: $20/month (for production apps)

## Monitoring

View logs in Railway dashboard:
1. Click on your service
2. Go to **Deployments** tab
3. Click on latest deployment
4. View **Logs**

## Scaling

Railway auto-scales within your plan limits. To handle more traffic:
1. Upgrade to Pro plan ($20/month)
2. Or migrate to Google Cloud Run when you hit limits

## Next Steps

Once deployed:
1. ✅ Test your backend: `https://your-backend.railway.app/health`
2. ✅ Test Google OAuth login
3. ✅ Create a startup/hackathon post
4. ✅ Test real-time features (WebSocket)
5. ✅ Share with friends!

## When to Migrate to Google Cloud Run

Migrate when you:
- Have 1000+ active users
- Need better performance
- Want to reduce costs at scale
- Need advanced features (Cloud SQL, Redis, etc.)
