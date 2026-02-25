# CodeJam - GCP Deployment Guide

Deploy your CodeJam application to Google Cloud Platform using Cloud Run.

---

## 🎯 What You'll Deploy

```
https://your-domain.com
         ↓
┌─────────────────────────────────┐
│  Google Cloud Platform          │
│                                  │
│  Cloud Run      Cloud Run       │
│  (Frontend)     (Backend)       │
└─────────────────────────────────┘
         ↓
   MongoDB Atlas (Free)
```

**Cost**: ~$5-10/month (Cloud Run free tier covers most usage)

---

## 📋 Prerequisites

1. Google Cloud account with billing enabled
2. MongoDB Atlas account (free tier)
3. Domain name (optional)
4. Google OAuth credentials
5. gcloud CLI installed

---

## 🚀 Deployment Steps

### Step 1: Setup MongoDB Atlas

1. Go to https://cloud.mongodb.com/
2. Create free M0 cluster
3. Database Access → Add user: `codejam_user` / `your-password`
4. Network Access → Add IP: `0.0.0.0/0` (allow all)
5. Copy connection string:
   ```
   mongodb+srv://codejam_user:PASSWORD@cluster.mongodb.net/codejam?retryWrites=true&w=majority
   ```

### Step 2: Setup Google Cloud Project

```bash
# Install gcloud CLI (if not installed)
# Visit: https://cloud.google.com/sdk/docs/install

# Login to Google Cloud
gcloud auth login

# Create new project
gcloud projects create codejam-prod --name="CodeJam Production"

# Set project
gcloud config set project codejam-prod

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### Step 3: Setup Secrets

```bash
# Create secrets for sensitive data
echo -n "your-mongodb-uri" | gcloud secrets create MONGODB_URI --data-file=-
echo -n "your-jwt-secret-min-32-chars" | gcloud secrets create JWT_SECRET --data-file=-
echo -n "your-google-client-secret" | gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=-
echo -n "your-supabase-service-key" | gcloud secrets create SUPABASE_SERVICE_KEY --data-file=-
```

### Step 4: Deploy Backend

```bash
cd app/server

# Build and deploy to Cloud Run
gcloud run deploy codejam-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production,PORT=8080,JWT_EXPIRES_IN=7d" \
  --set-env-vars "GOOGLE_CLIENT_ID=826418995384-i8skr4dciv9n1fa8l0bpg8jcl3hjohjm.apps.googleusercontent.com" \
  --set-env-vars "SUPABASE_URL=https://jbtpedvggpbxltjftsbr.supabase.co" \
  --set-secrets "MONGODB_URI=MONGODB_URI:latest,JWT_SECRET=JWT_SECRET:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,SUPABASE_SERVICE_KEY=SUPABASE_SERVICE_KEY:latest"

# Note the backend URL (e.g., https://codejam-backend-xxx-uc.a.run.app)
```

### Step 5: Update Backend Environment

```bash
# Get backend URL
BACKEND_URL=$(gcloud run services describe codejam-backend --region us-central1 --format 'value(status.url)')

echo "Backend URL: $BACKEND_URL"
```

### Step 6: Deploy Frontend

```bash
cd ../  # Back to app folder

# Update .env for build
cat > .env << EOF
VITE_API_URL=${BACKEND_URL}/api
VITE_GOOGLE_CLIENT_ID=826418995384-i8skr4dciv9n1fa8l0bpg8jcl3hjohjm.apps.googleusercontent.com
EOF

# Build and deploy
gcloud run deploy codejam-frontend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5

# Note the frontend URL (e.g., https://codejam-frontend-xxx-uc.a.run.app)
```

### Step 7: Update Backend FRONTEND_URL

```bash
# Get frontend URL
FRONTEND_URL=$(gcloud run services describe codejam-frontend --region us-central1 --format 'value(status.url)')

# Update backend with frontend URL
gcloud run services update codejam-backend \
  --region us-central1 \
  --set-env-vars "FRONTEND_URL=${FRONTEND_URL}"
```

### Step 8: Update Google OAuth

1. Go to https://console.cloud.google.com
2. APIs & Services → Credentials
3. Click your OAuth 2.0 Client ID
4. Add to "Authorized JavaScript origins":
   ```
   https://codejam-frontend-xxx-uc.a.run.app
   ```
5. Add to "Authorized redirect URIs":
   ```
   https://codejam-frontend-xxx-uc.a.run.app/auth
   ```
6. Save

---

## 🌐 Custom Domain (Optional)

### Setup Custom Domain

```bash
# Map domain to frontend
gcloud run domain-mappings create \
  --service codejam-frontend \
  --domain codejam.space \
  --region us-central1

# Map subdomain to backend
gcloud run domain-mappings create \
  --service codejam-backend \
  --domain api.codejam.space \
  --region us-central1

# Follow DNS instructions shown in output
```

### Update DNS Records

Add these records to your domain registrar:

```
Type    Host    Value (from gcloud output)
CNAME   @       ghs.googlehosted.com
CNAME   api     ghs.googlehosted.com
```

### Update Environment Variables

```bash
# Update backend
gcloud run services update codejam-backend \
  --region us-central1 \
  --set-env-vars "FRONTEND_URL=https://codejam.space"

# Rebuild frontend with new API URL
cd app
cat > .env << EOF
VITE_API_URL=https://api.codejam.space/api
VITE_GOOGLE_CLIENT_ID=826418995384-i8skr4dciv9n1fa8l0bpg8jcl3hjohjm.apps.googleusercontent.com
EOF

# Redeploy frontend
gcloud run deploy codejam-frontend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 🔧 Management Commands

### View Logs

```bash
# Backend logs
gcloud run logs read codejam-backend --region us-central1 --limit 50

# Frontend logs
gcloud run logs read codejam-frontend --region us-central1 --limit 50

# Stream logs
gcloud run logs tail codejam-backend --region us-central1
```

### Update Backend

```bash
cd app/server

# Redeploy
gcloud run deploy codejam-backend \
  --source . \
  --region us-central1
```

### Update Frontend

```bash
cd app

# Redeploy
gcloud run deploy codejam-frontend \
  --source . \
  --region us-central1
```

### Update Secrets

```bash
# Update MongoDB URI
echo -n "new-mongodb-uri" | gcloud secrets versions add MONGODB_URI --data-file=-

# Restart backend to use new secret
gcloud run services update codejam-backend --region us-central1
```

### Scale Services

```bash
# Increase backend capacity
gcloud run services update codejam-backend \
  --region us-central1 \
  --max-instances 20 \
  --memory 1Gi \
  --cpu 2

# Set minimum instances (always warm)
gcloud run services update codejam-backend \
  --region us-central1 \
  --min-instances 1
```

---

## 💰 Cost Optimization

### Free Tier Limits
- 2 million requests/month
- 360,000 GB-seconds/month
- 180,000 vCPU-seconds/month

### Tips
1. Use `--min-instances 0` for development (cold starts OK)
2. Use `--min-instances 1` for production (no cold starts)
3. Monitor usage in Cloud Console
4. Set budget alerts

---

## ✅ Testing Checklist

- [ ] Backend health check: `curl https://your-backend-url/health`
- [ ] Frontend loads: `https://your-frontend-url`
- [ ] Sign up works
- [ ] Login works
- [ ] Google OAuth works
- [ ] Create startup works
- [ ] Create hackathon works
- [ ] Workspace loads
- [ ] Real-time chat works
- [ ] File upload works

---

## 🐛 Troubleshooting

### Backend not starting
```bash
# Check logs
gcloud run logs read codejam-backend --region us-central1 --limit 100

# Common issues:
# - MongoDB connection string incorrect
# - JWT_SECRET not set
# - Port not set to 8080
```

### Frontend shows blank page
```bash
# Check if API URL is correct
# Rebuild with correct VITE_API_URL
cd app
cat .env
npm run build
gcloud run deploy codejam-frontend --source . --region us-central1
```

### CORS errors
```bash
# Ensure FRONTEND_URL is set correctly in backend
gcloud run services describe codejam-backend --region us-central1 | grep FRONTEND_URL

# Update if needed
gcloud run services update codejam-backend \
  --region us-central1 \
  --set-env-vars "FRONTEND_URL=https://your-frontend-url"
```

### WebSocket not working
Cloud Run doesn't support WebSocket connections. Options:
1. Deploy backend to GCE (Compute Engine) VM
2. Use Firebase Realtime Database for real-time features
3. Use polling instead of WebSocket

---

## 📊 Your Configuration

**Project ID**: codejam-prod
**Region**: us-central1
**Backend**: https://codejam-backend-xxx-uc.a.run.app
**Frontend**: https://codejam-frontend-xxx-uc.a.run.app
**Database**: MongoDB Atlas (cluster0.lbgovtk.mongodb.net)

---

## 🎉 Success!

Your CodeJam application is now live on Google Cloud Platform!

**Next Steps**:
1. Set up monitoring and alerts
2. Configure Cloud CDN for better performance
3. Set up CI/CD with Cloud Build
4. Enable Cloud Armor for DDoS protection

---

**Last Updated**: February 2026
**Platform**: Google Cloud Platform (Cloud Run)
