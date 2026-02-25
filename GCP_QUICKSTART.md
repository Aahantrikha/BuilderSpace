# CodeJam - GCP Quick Start (30 Minutes)

Get your CodeJam app running on Google Cloud Platform in 30 minutes.

---

## Prerequisites

1. Google Cloud account with billing enabled
2. MongoDB Atlas account (free)
3. gcloud CLI installed ([Install Guide](https://cloud.google.com/sdk/docs/install))

---

## Step 1: Install gcloud CLI (5 min)

### Windows
```powershell
# Download and run installer
# https://cloud.google.com/sdk/docs/install#windows
```

### Mac
```bash
brew install --cask google-cloud-sdk
```

### Linux
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

**Verify installation:**
```bash
gcloud --version
```

---

## Step 2: Setup MongoDB Atlas (5 min)

1. Go to https://cloud.mongodb.com/
2. Create free M0 cluster
3. Database Access → Add user: `codejam_user` / `YourPassword123`
4. Network Access → Add IP: `0.0.0.0/0`
5. Copy connection string:
   ```
   mongodb+srv://codejam_user:YourPassword123@cluster0.xxxxx.mongodb.net/codejam?retryWrites=true&w=majority
   ```

---

## Step 3: Login to Google Cloud (2 min)

```bash
# Login
gcloud auth login

# Follow browser prompts to authenticate
```

---

## Step 4: Run Setup Script (5 min)

```bash
# Make script executable
chmod +x setup-gcp.sh

# Run setup
./setup-gcp.sh
```

**You'll be prompted for:**
- MongoDB URI (from Step 2)
- JWT Secret (any random 32+ character string)
- Google Client Secret: `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`
- Supabase Service Key: (your key from Supabase dashboard)

---

## Step 5: Deploy Application (10 min)

```bash
# Make script executable
chmod +x deploy-gcp.sh

# Deploy
./deploy-gcp.sh
```

**This will:**
- Deploy backend to Cloud Run
- Deploy frontend to Cloud Run
- Configure environment variables
- Output your application URLs

**Example output:**
```
Backend:  https://codejam-backend-xxx-uc.a.run.app
Frontend: https://codejam-frontend-xxx-uc.a.run.app
```

---

## Step 6: Update Google OAuth (3 min)

1. Go to https://console.cloud.google.com
2. APIs & Services → Credentials
3. Click OAuth 2.0 Client ID: `826418995384-i8skr4dciv9n1fa8l0bpg8jcl3hjohjm`
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

## Step 7: Test Your App (5 min)

Open your frontend URL: `https://codejam-frontend-xxx-uc.a.run.app`

**Test checklist:**
- [ ] Page loads
- [ ] Sign up works
- [ ] Login works
- [ ] Google OAuth works
- [ ] Create startup works
- [ ] Create hackathon works

---

## 🎉 Done!

Your CodeJam app is now live on Google Cloud Platform!

---

## Common Issues

### "Permission denied" error
```bash
# Enable billing on your project
gcloud billing accounts list
gcloud billing projects link codejam-prod --billing-account=ACCOUNT_ID
```

### Backend not starting
```bash
# Check logs
gcloud run logs read codejam-backend --region us-central1 --limit 50

# Common fix: verify MongoDB URI is correct
```

### Frontend shows blank page
```bash
# Check if API URL is correct in frontend
gcloud run services describe codejam-frontend --region us-central1
```

---

## Update Your App

### Update backend
```bash
cd app/server
gcloud run deploy codejam-backend --source . --region us-central1
```

### Update frontend
```bash
cd app
gcloud run deploy codejam-frontend --source . --region us-central1
```

---

## Cost

**Free tier includes:**
- 2 million requests/month
- 360,000 GB-seconds/month
- 180,000 vCPU-seconds/month

**Expected cost:** $0-5/month for low traffic

---

## Next Steps

1. Setup custom domain (optional)
2. Configure monitoring
3. Enable Cloud CDN
4. Setup CI/CD with Cloud Build

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.
