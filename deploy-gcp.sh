#!/bin/bash

# CodeJam GCP Deployment Script
# Run this after setting up gcloud CLI and creating secrets

set -e

echo "=================================="
echo "CodeJam GCP Deployment"
echo "=================================="
echo ""

# Configuration
PROJECT_ID="codejam-prod"
REGION="us-central1"
GOOGLE_CLIENT_ID="826418995384-i8skr4dciv9n1fa8l0bpg8jcl3hjohjm.apps.googleusercontent.com"
SUPABASE_URL="https://jbtpedvggpbxltjftsbr.supabase.co"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Step 1: Setting project...${NC}"
gcloud config set project $PROJECT_ID

echo -e "${GREEN}Step 2: Deploying backend...${NC}"
cd app/server
gcloud run deploy codejam-backend \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production,PORT=8080,JWT_EXPIRES_IN=7d,GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID,SUPABASE_URL=$SUPABASE_URL" \
  --set-secrets "MONGODB_URI=MONGODB_URI:latest,JWT_SECRET=JWT_SECRET:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,SUPABASE_SERVICE_KEY=SUPABASE_SERVICE_KEY:latest"

echo -e "${GREEN}Step 3: Getting backend URL...${NC}"
BACKEND_URL=$(gcloud run services describe codejam-backend --region $REGION --format 'value(status.url)')
echo "Backend URL: $BACKEND_URL"

echo -e "${GREEN}Step 4: Building frontend...${NC}"
cd ..
cat > .env << EOF
VITE_API_URL=${BACKEND_URL}/api
VITE_GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
EOF

echo -e "${GREEN}Step 5: Deploying frontend...${NC}"
gcloud run deploy codejam-frontend \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5

echo -e "${GREEN}Step 6: Getting frontend URL...${NC}"
FRONTEND_URL=$(gcloud run services describe codejam-frontend --region $REGION --format 'value(status.url)')
echo "Frontend URL: $FRONTEND_URL"

echo -e "${GREEN}Step 7: Updating backend with frontend URL...${NC}"
gcloud run services update codejam-backend \
  --region $REGION \
  --set-env-vars "FRONTEND_URL=${FRONTEND_URL}"

echo ""
echo "=================================="
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "=================================="
echo ""
echo "Backend:  $BACKEND_URL"
echo "Frontend: $FRONTEND_URL"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Update Google OAuth with frontend URL"
echo "2. Test the application"
echo "3. (Optional) Setup custom domain"
echo ""
