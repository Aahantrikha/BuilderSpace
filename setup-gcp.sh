#!/bin/bash

# CodeJam GCP Initial Setup Script
# Run this ONCE to setup your GCP project

set -e

echo "=================================="
echo "CodeJam GCP Initial Setup"
echo "=================================="
echo ""

# Configuration
PROJECT_ID="codejam-prod"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}This script will:${NC}"
echo "1. Create GCP project"
echo "2. Enable required APIs"
echo "3. Create secrets"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

echo -e "${GREEN}Step 1: Creating project...${NC}"
gcloud projects create $PROJECT_ID --name="CodeJam Production" || echo "Project already exists"

echo -e "${GREEN}Step 2: Setting project...${NC}"
gcloud config set project $PROJECT_ID

echo -e "${GREEN}Step 3: Enabling APIs...${NC}"
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com

echo -e "${GREEN}Step 4: Creating secrets...${NC}"
echo ""
echo -e "${YELLOW}Enter your MongoDB URI:${NC}"
read -s MONGODB_URI
echo -n "$MONGODB_URI" | gcloud secrets create MONGODB_URI --data-file=- || echo "Secret already exists"

echo ""
echo -e "${YELLOW}Enter your JWT secret (min 32 chars):${NC}"
read -s JWT_SECRET
echo -n "$JWT_SECRET" | gcloud secrets create JWT_SECRET --data-file=- || echo "Secret already exists"

echo ""
echo -e "${YELLOW}Enter your Google Client Secret:${NC}"
read -s GOOGLE_CLIENT_SECRET
echo -n "$GOOGLE_CLIENT_SECRET" | gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=- || echo "Secret already exists"

echo ""
echo -e "${YELLOW}Enter your Supabase Service Key:${NC}"
read -s SUPABASE_SERVICE_KEY
echo -n "$SUPABASE_SERVICE_KEY" | gcloud secrets create SUPABASE_SERVICE_KEY --data-file=- || echo "Secret already exists"

echo ""
echo "=================================="
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "=================================="
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Run ./deploy-gcp.sh to deploy your application"
echo ""
