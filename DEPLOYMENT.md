# CodeJam Deployment Guide - OCI + codejam.space

Complete guide to deploy your CodeJam application on Oracle Cloud Infrastructure with custom domain.

---

## 📋 What You'll Deploy

```
https://codejam.space (Your Domain)
         ↓
┌─────────────────────────────────┐
│  Oracle Cloud (Free Tier)       │
│                                  │
│  Frontend VM    Backend VM      │
│  (Nginx)        (Node.js)       │
└─────────────────────────────────┘
         ↓
   MongoDB Atlas (Free)
```

**Total Cost**: ~$1.25/month (just the domain)

---

## 🚀 Quick Start (1 Hour Total)

### Part 1: Deploy to OCI (30 minutes)

#### Step 1: Create OCI Account
1. Go to https://cloud.oracle.com/
2. Sign up for free tier
3. Complete verification

#### Step 2: Setup MongoDB Atlas
1. Go to https://cloud.mongodb.com/
2. Create free M0 cluster
3. Add database user: `codejam_user` / `your-password`
4. Network Access: Add `0.0.0.0/0`
5. Copy connection string:
   ```
   mongodb+srv://codejam_user:PASSWORD@cluster.mongodb.net/codejam?retryWrites=true&w=majority
   ```

#### Step 3: Create VCN (Virtual Network)
1. OCI Console → Networking → Virtual Cloud Networks
2. Click "Create VCN with Internet Connectivity"
3. Name: `codejam-vcn`
4. Use defaults, click Create

#### Step 4: Configure Security (Firewall)
1. VCN → Security Lists → Default Security List
2. Add Ingress Rules:
   ```
   Source: 0.0.0.0/0, Protocol: TCP, Port: 22 (SSH)
   Source: 0.0.0.0/0, Protocol: TCP, Port: 80 (HTTP)
   Source: 0.0.0.0/0, Protocol: TCP, Port: 443 (HTTPS)
   Source: 0.0.0.0/0, Protocol: TCP, Port: 3001 (Backend)
   ```

#### Step 5: Create Backend VM
1. Compute → Instances → Create Instance
2. Name: `codejam-backend`
3. Image: Ubuntu 22.04
4. Shape: VM.Standard.E2.1.Micro (Free tier)
5. VCN: codejam-vcn, Subnet: Public
6. Assign Public IP: Yes
7. Add SSH key (generate or upload)
8. Create
9. **Note Backend IP**: `xxx.xxx.xxx.xxx`

#### Step 6: Create Frontend VM
1. Repeat Step 5
2. Name: `codejam-frontend`
3. **Note Frontend IP**: `yyy.yyy.yyy.yyy`

#### Step 7: Deploy Backend
```bash
# SSH into backend VM
ssh -i your-key.pem ubuntu@xxx.xxx.xxx.xxx

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
sudo npm install -g pm2

# Clone repository
cd /home/ubuntu
git clone https://github.com/Aahantrikha/BuilderSpace.git
cd BuilderSpace/app/server

# Install dependencies
npm install
npm run build

# Create .env file
nano .env
```

**Add to .env**:
```env
MONGODB_URI="mongodb+srv://codejam_user:PASSWORD@cluster.mongodb.net/codejam?retryWrites=true&w=majority"
JWT_SECRET="your-super-secret-jwt-key-at-least-32-characters-long"
JWT_EXPIRES_IN="7d"
GOOGLE_CLIENT_ID="826418995384-i8skr4dciv9n1fa8l0bpg8jcl3hjohjm.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="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"
PORT=3001
NODE_ENV="production"
FRONTEND_URL="http://yyy.yyy.yyy.yyy"
SUPABASE_URL="https://jbtpedvggpbxltjftsbr.supabase.co"
SUPABASE_SERVICE_KEY="your-supabase-service-key"
```

**Start backend**:
```bash
# Start with PM2
pm2 start dist/server.js --name codejam-backend
pm2 save
pm2 startup
# Run the command it outputs

# Configure firewall
sudo ufw allow 22/tcp
sudo ufw allow 3001/tcp
sudo ufw enable

# Test
curl http://localhost:3001/health
```

#### Step 8: Deploy Frontend
```bash
# SSH into frontend VM
ssh -i your-key.pem ubuntu@yyy.yyy.yyy.yyy

# Install Nginx and Node.js
sudo apt update
sudo apt install -y nginx nodejs npm git

# Clone repository
cd /home/ubuntu
git clone https://github.com/Aahantrikha/BuilderSpace.git
cd BuilderSpace/app

# Create .env
nano .env
```

**Add to .env**:
```env
VITE_API_URL=http://xxx.xxx.xxx.xxx:3001/api
VITE_GOOGLE_CLIENT_ID=826418995384-i8skr4dciv9n1fa8l0bpg8jcl3hjohjm.apps.googleusercontent.com
```

**Build and configure**:
```bash
# Build
npm install
npm run build

# Configure Nginx
sudo nano /etc/nginx/sites-available/codejam
```

**Add to Nginx config**:
```nginx
server {
    listen 80;
    server_name _;
    root /home/ubuntu/BuilderSpace/app/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://xxx.xxx.xxx.xxx:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Enable and start**:
```bash
sudo ln -s /etc/nginx/sites-available/codejam /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# Configure firewall
sudo ufw allow 'Nginx Full'
sudo ufw allow 22/tcp
sudo ufw enable
```

**Test**: Open `http://yyy.yyy.yyy.yyy` in browser

---

### Part 2: Add Custom Domain (30 minutes)

#### Step 1: Configure DNS
1. Login to your domain registrar (where you bought codejam.space)
2. Go to DNS Management
3. Add A Records:
   ```
   Type    Host    Value               TTL
   A       @       yyy.yyy.yyy.yyy    3600
   A       www     yyy.yyy.yyy.yyy    3600
   ```
4. Save and wait 5-30 minutes for DNS propagation

**Test DNS**:
```bash
nslookup codejam.space
```

#### Step 2: Update Nginx for Domain
```bash
# SSH into frontend VM
ssh -i your-key.pem ubuntu@yyy.yyy.yyy.yyy

# Edit Nginx config
sudo nano /etc/nginx/sites-available/codejam
```

**Change `server_name` line to**:
```nginx
server_name codejam.space www.codejam.space;
```

**Reload**:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

**Test**: Open `http://codejam.space` in browser

#### Step 3: Install SSL Certificate (Free)
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d codejam.space -d www.codejam.space

# Follow prompts:
# - Enter email
# - Agree to terms (Y)
# - Redirect HTTP to HTTPS (2)
```

**Test**: Open `https://codejam.space` - should see 🔒 padlock!

#### Step 4: Update Backend Environment
```bash
# SSH into backend VM
ssh -i your-key.pem ubuntu@xxx.xxx.xxx.xxx

# Edit .env
nano /home/ubuntu/BuilderSpace/app/server/.env
```

**Change FRONTEND_URL to**:
```env
FRONTEND_URL="https://codejam.space"
```

**Restart**:
```bash
pm2 restart codejam-backend
```

#### Step 5: Update Google OAuth
1. Go to https://console.cloud.google.com
2. APIs & Services → Credentials
3. Click your OAuth 2.0 Client ID
4. Add to "Authorized JavaScript origins":
   ```
   https://codejam.space
   https://www.codejam.space
   ```
5. Add to "Authorized redirect URIs":
   ```
   https://codejam.space
   https://codejam.space/auth
   ```
6. Save

---

## ✅ Testing Checklist

- [ ] `https://codejam.space` loads with 🔒 padlock
- [ ] `http://codejam.space` redirects to HTTPS
- [ ] Sign up works
- [ ] Login works
- [ ] Google OAuth works
- [ ] Create startup works
- [ ] Create hackathon works
- [ ] Workspace loads
- [ ] Real-time chat works
- [ ] Tasks work
- [ ] Links work

---

## 🔧 Common Commands

### Backend Management
```bash
# SSH
ssh -i key.pem ubuntu@xxx.xxx.xxx.xxx

# Check status
pm2 status
pm2 logs codejam-backend

# Restart
pm2 restart codejam-backend

# Update code
cd /home/ubuntu/BuilderSpace/app/server
git pull
npm install
npm run build
pm2 restart codejam-backend
```

### Frontend Management
```bash
# SSH
ssh -i key.pem ubuntu@yyy.yyy.yyy.yyy

# Check Nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log

# Restart
sudo systemctl restart nginx

# Update code
cd /home/ubuntu/BuilderSpace/app
git pull
npm install
npm run build
sudo systemctl restart nginx
```

---

## 🐛 Troubleshooting

### Backend not starting
```bash
pm2 logs codejam-backend
# Check MongoDB connection string
# Verify .env file exists
```

### Frontend shows blank page
```bash
cd /home/ubuntu/BuilderSpace/app
npm run build
sudo systemctl restart nginx
```

### Domain not loading
```bash
nslookup codejam.space
# Wait for DNS propagation (up to 48 hours)
```

### SSL certificate fails
```bash
# Ensure DNS is propagated first
# Ensure ports 80 and 443 are open
sudo ufw status
sudo certbot certificates
```

### CORS errors
```bash
# Verify FRONTEND_URL in backend .env
# Restart backend
pm2 restart codejam-backend
```

---

## 📊 Your Configuration

**Domain**: codejam.space
**Frontend IP**: yyy.yyy.yyy.yyy
**Backend IP**: xxx.xxx.xxx.xxx
**Frontend URL**: https://codejam.space
**API URL**: http://xxx.xxx.xxx.xxx:3001/api
**Database**: MongoDB Atlas (cluster0.lbgovtk.mongodb.net)

---

## 💰 Monthly Cost

- OCI VMs (2x): $0 (free tier)
- MongoDB Atlas: $0 (free tier)
- Supabase: $0 (free tier)
- SSL Certificate: $0 (Let's Encrypt)
- Domain: ~$1.25/month

**Total: ~$1.25/month**

---

## 🎉 Success!

Your CodeJam application is now live at **https://codejam.space**!

Share it with your users and start building amazing teams! 🚀

---

**Last Updated**: February 2026
**Platform**: Oracle Cloud Infrastructure
**Domain**: codejam.space
