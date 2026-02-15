#!/bin/bash

# CodeJam Backend - Google Cloud Run Deployment Script

echo "🚀 Deploying CodeJam Backend to Google Cloud Run..."

# Configuration
PROJECT_ID="your-project-id"  # Change this to your GCP project ID
SERVICE_NAME="codejam-backend"
REGION="us-central1"  # Change to your preferred region

# Build and deploy
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "JWT_SECRET=$JWT_SECRET" \
  --set-env-vars "GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID" \
  --set-env-vars "GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET" \
  --set-env-vars "FRONTEND_URL=$FRONTEND_URL" \
  --min-instances 0 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --port 8080

echo "✅ Deployment complete!"
echo "Your backend URL will be shown above"
