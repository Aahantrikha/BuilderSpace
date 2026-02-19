# Backend Deployment Guide

## Quick Deploy Options

### Option 1: Render (Recommended)

1. **Push to GitHub**
2. **Create Web Service** on [Render](https://render.com/)
3. **Configure**:
   - Root Directory: `app/server`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
4. **Add Environment Variables** (see `.env.example`)
5. **Deploy!**

See `render.yaml` for configuration.

### Option 2: Railway

1. **Push to GitHub**
2. **New Project** on [Railway](https://railway.app/)
3. **Set Root Directory**: `app/server`
4. **Add Environment Variables** (see `.env.example`)
5. **Deploy!**

See `railway.json` for configuration.

## Environment Variables

Required variables (see `.env.example` for full list):

```env
NODE_ENV=production
PORT=3001
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
FRONTEND_URL=your_frontend_url
```

## Post-Deployment

1. Update `FRONTEND_URL` with your actual frontend URL
2. Configure Google OAuth with production URLs
3. Test all endpoints
4. Monitor logs for errors

## Support

- Render Docs: https://render.com/docs
- Railway Docs: https://docs.railway.app/
