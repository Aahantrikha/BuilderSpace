# CodeJam Backend - Google Cloud Run Deployment Guide

## Prerequisites

1. **Google Cloud Account** with $300 credits
2. **gcloud CLI** installed: https://cloud.google.com/sdk/docs/install
3. **Docker** installed (optional, Cloud Run can build for you)

## Step-by-Step Deployment

### 1. Setup Google Cloud Project

```bash
# Login to Google Cloud
gcloud auth login

# Create a new project (or use existing)
gcloud projects create codejam-prod --name="CodeJam"

# Set the project
gcloud config set project codejam-prod

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable sqladmin.googleapis.com
```

### 2. Setup Cloud SQL (PostgreSQL) - IMPORTANT!

SQLite won't work on Cloud Run. You need Cloud SQL:

```bash
# Create PostgreSQL instance
gcloud sql instances create codejam-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database
gcloud sql databases create codejam --instance=codejam-db

# Create user
gcloud sql users create codejam-user \
  --instance=codejam-db \
  --password=YOUR_SECURE_PASSWORD

# Get connection name (save this!)
gcloud sql instances describe codejam-db --format="value(connectionName)"
```

### 3. Update Database Connection

You'll need to update your code to use PostgreSQL instead of SQLite.

**In `.env` (for production):**
```env
DATABASE_URL="postgresql://codejam-user:YOUR_PASSWORD@/codejam?host=/cloudsql/PROJECT_ID:REGION:codejam-db"
```

### 4. Deploy to Cloud Run

```bash
# Navigate to server directory
cd app/server

# Deploy (Cloud Run will build the Docker image for you)
gcloud run deploy codejam-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "JWT_SECRET=your-super-secret-key-change-this" \
  --set-env-vars "GOOGLE_CLIENT_ID=your-google-client-id" \
  --set-env-vars "GOOGLE_CLIENT_SECRET=your-google-client-secret" \
  --set-env-vars "FRONTEND_URL=https://your-frontend-domain.vercel.app" \
  --add-cloudsql-instances PROJECT_ID:REGION:codejam-db \
  --min-instances 0 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --port 8080
```

### 5. Get Your Backend URL

After deployment, you'll get a URL like:
```
https://codejam-backend-xxxxx-uc.a.run.app
```

Save this URL - you'll need it for your frontend!

### 6. Update Frontend Environment

Update `app/.env`:
```env
VITE_API_URL=https://codejam-backend-xxxxx-uc.a.run.app/api
```

### 7. Update Google OAuth

Add your Cloud Run URL to Google OAuth:
1. Go to Google Cloud Console
2. APIs & Services > Credentials
3. Edit your OAuth client
4. Add to Authorized JavaScript origins:
   - `https://codejam-backend-xxxxx-uc.a.run.app`
   - `https://your-frontend-domain.vercel.app`

## Cost Estimate (with $300 credits)

- **Cloud Run**: ~$5-10/month (first 2 million requests free)
- **Cloud SQL**: ~$7/month (db-f1-micro)
- **Total**: ~$12-17/month

Your $300 credits will last **15-20 months**!

## Scaling Configuration

Cloud Run auto-scales based on traffic:
- **0 instances** when no traffic (pay nothing!)
- **Up to 10 instances** during high traffic
- Each instance handles ~80 concurrent requests

To handle more traffic, just increase `--max-instances`:
```bash
gcloud run services update codejam-backend --max-instances 100
```

## Alternative: Keep SQLite Temporarily

If you want to deploy quickly without migrating to PostgreSQL:

1. Use **Railway** or **Fly.io** instead (they support SQLite)
2. Migrate to Cloud SQL later when you need to scale

## Monitoring

View logs:
```bash
gcloud run logs read codejam-backend --limit 50
```

View metrics:
```bash
gcloud run services describe codejam-backend
```

## Troubleshooting

**Issue**: Database connection fails
- Check Cloud SQL connection name is correct
- Verify database credentials
- Ensure Cloud SQL API is enabled

**Issue**: Cold starts are slow
- Set `--min-instances 1` to keep one instance warm
- Costs ~$5/month extra but eliminates cold starts

**Issue**: WebSocket not working
- Cloud Run supports WebSocket but requires HTTP/2
- Ensure your WebSocket client uses `wss://` (secure WebSocket)

## Need Help?

- Cloud Run docs: https://cloud.google.com/run/docs
- Cloud SQL docs: https://cloud.google.com/sql/docs
