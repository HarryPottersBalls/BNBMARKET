# 🚀 Render.com Deployment Guide - BNBMARKET

Complete guide for deploying BNBMARKET to Render.com with proper environment configuration.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Backend Deployment](#backend-deployment)
3. [Frontend Deployment](#frontend-deployment)
4. [Database Setup](#database-setup)
5. [Environment Variables](#environment-variables)
6. [Post-Deployment](#post-deployment)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts
- ✅ [Render.com account](https://render.com) (free tier available)
- ✅ [GitHub account](https://github.com) with repository access
- ✅ [Cloudinary account](https://cloudinary.com)
- ✅ [WalletConnect Cloud account](https://cloud.walletconnect.com)

### Required Information
Before starting, gather these credentials:
- PostgreSQL database credentials (Render provides this)
- Cloudinary API credentials
- WalletConnect Project ID
- Admin wallet address
- reCAPTCHA keys (optional)

---

## Backend Deployment

### Step 1: Create New Web Service

1. **Login to Render Dashboard**
   - Go to https://dashboard.render.com/
   - Click **"New +"** → **"Web Service"**

2. **Connect Repository**
   - Select **"Connect a repository"**
   - Authorize Render to access your GitHub
   - Select: `HarryPottersBalls/BNBMARKET`

3. **Configure Service**
   ```
   Name:                bnbmarket-backend
   Region:             Oregon (US West) or closest to users
   Branch:             main
   Root Directory:     (leave empty - uses repo root)
   Runtime:            Node
   Build Command:      npm install
   Start Command:      node server.js
   Instance Type:      Free (or Starter for production)
   ```

4. **Click "Create Web Service"** (don't deploy yet - we need env vars)

### Step 2: Configure Environment Variables

In the Render dashboard for your service:

1. Go to **"Environment"** tab
2. Click **"Add Environment Variable"**
3. Add each variable below:

#### Required Backend Variables

```bash
# Server Configuration
NODE_ENV=production
PORT=10000

# Database (automatically provided by Render if using their PostgreSQL)
DATABASE_URL=<WILL_BE_PROVIDED_BY_RENDER_POSTGRES>

# Authentication
ADMIN_WALLET=<YOUR_ADMIN_WALLET_ADDRESS>

# Blockchain
BSC_RPC_URL=https://bsc-dataseed1.binance.org/

# Cloudinary (get from https://cloudinary.com/console/settings/security)
CLOUDINARY_URL=cloudinary://<API_KEY>:<API_SECRET>@<CLOUD_NAME>

# WalletConnect (get from https://cloud.walletconnect.com/)
WALLETCONNECT_PROJECT_ID=<YOUR_32_CHAR_PROJECT_ID>

# Security
RECAPTCHA_SECRET_KEY=<YOUR_RECAPTCHA_SECRET>
RECAPTCHA_THRESHOLD=0.5

# Feature Config
EARLY_UNSTAKING_FEE_PERCENTAGE=0.05
TRANSACTION_FEE_PERCENTAGE=0.01
```

#### How to Get Each Value:

**ADMIN_WALLET:**
```
Your BSC wallet address that will have admin privileges
Example: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

**CLOUDINARY_URL:**
1. Login to https://cloudinary.com/console/settings/security
2. Navigate to "Access Keys"
3. Copy the "API Environment variable" (starts with `cloudinary://`)
4. **IMPORTANT:** If you previously exposed credentials, click "Regenerate" first!

**WALLETCONNECT_PROJECT_ID:**
1. Login to https://cloud.walletconnect.com/
2. Create a new project: Click "New Project"
3. Name it: "BNBMARKET Production"
4. Copy the 32-character Project ID
5. **IMPORTANT:** If old ID was exposed, create new project and delete old one!

**RECAPTCHA_SECRET_KEY:**
1. Go to https://www.google.com/recaptcha/admin
2. Register your site (use reCAPTCHA v3)
3. Add your Render domain: `your-app.onrender.com`
4. Copy the Secret Key

### Step 3: Deploy Backend

1. Click **"Manual Deploy"** → **"Deploy latest commit"**
2. Monitor deployment logs
3. Wait for "Live" status (takes ~5-10 minutes)
4. Note your backend URL: `https://bnbmarket-backend.onrender.com`

---

## Database Setup

### Option A: Render PostgreSQL (Recommended)

1. **Create PostgreSQL Database**
   - Click **"New +"** → **"PostgreSQL"**
   - Name: `bnbmarket-db`
   - Region: Same as your web service
   - Plan: Free (or paid for production)
   - Click **"Create Database"**

2. **Connect to Web Service**
   - Go to your web service settings
   - Scroll to **"Environment Variables"**
   - Render automatically provides: `DATABASE_URL`
   - Or manually add from database dashboard → "Internal Database URL"

3. **Initialize Tables**
   The migrations will run automatically on first start.
   Check logs for: `✓ Database migrations completed`

### Option B: External PostgreSQL

If using external database (AWS RDS, ElephantSQL, etc.):

```bash
# Format
DATABASE_URL=postgresql://username:password@host:port/database?ssl=true

# Example
DATABASE_URL=postgresql://user:pass@db.example.com:5432/bnbmarket?ssl=true
```

---

## Frontend Deployment

### Step 1: Create Static Site

1. **Create New Static Site**
   - Click **"New +"** → **"Static Site"**
   - Select repository: `HarryPottersBalls/BNBMARKET`

2. **Configure Build**
   ```
   Name:                bnbmarket-frontend
   Branch:             main
   Root Directory:     client
   Build Command:      npm install && npm run build
   Publish Directory:  build (or dist if using Vite)
   ```

### Step 2: Configure Frontend Environment Variables

Add these in the **"Environment"** tab of your static site:

```bash
# WalletConnect (SAME as backend!)
REACT_APP_WALLETCONNECT_PROJECT_ID=<SAME_32_CHAR_ID>
VITE_WALLETCONNECT_PROJECT_ID=<SAME_32_CHAR_ID>

# Cloudinary Cloud Name (public, safe to expose)
REACT_APP_CLOUDINARY_CLOUD_NAME=<YOUR_CLOUD_NAME>
VITE_CLOUDINARY_CLOUD_NAME=<YOUR_CLOUD_NAME>

# Backend API URL (from Step 3 of Backend Deployment)
REACT_APP_API_URL=https://bnbmarket-backend.onrender.com
VITE_API_URL=https://bnbmarket-backend.onrender.com

# Network Configuration
REACT_APP_NETWORK=mainnet
VITE_NETWORK=mainnet
REACT_APP_CHAIN_ID=56
VITE_CHAIN_ID=56

# Optional: Analytics
REACT_APP_ENABLE_DEBUG=false
VITE_ENABLE_DEBUG=false
REACT_APP_ENABLE_ANALYTICS=true
VITE_ENABLE_ANALYTICS=true
```

### Step 3: Deploy Frontend

1. Click **"Create Static Site"**
2. Wait for build to complete (~3-5 minutes)
3. Note your frontend URL: `https://bnbmarket-frontend.onrender.com`

---

## Environment Variables Reference

### Complete Backend Environment Variables

Copy this template for Render:

```bash
# =============================================================================
# Backend Environment Variables for Render.com
# =============================================================================

# Server
NODE_ENV=production
PORT=10000

# Database (provided by Render PostgreSQL)
DATABASE_URL=<PROVIDED_BY_RENDER>

# Admin
ADMIN_WALLET=0xYOUR_WALLET_ADDRESS_HERE

# Blockchain
BSC_RPC_URL=https://bsc-dataseed1.binance.org/

# Cloudinary
CLOUDINARY_URL=cloudinary://KEY:SECRET@CLOUD_NAME

# WalletConnect
WALLETCONNECT_PROJECT_ID=your_32_character_project_id

# Security
RECAPTCHA_SECRET_KEY=your_secret_key
RECAPTCHA_THRESHOLD=0.5

# Features
EARLY_UNSTAKING_FEE_PERCENTAGE=0.05
TRANSACTION_FEE_PERCENTAGE=0.01
```

### Complete Frontend Environment Variables

Copy this template for Render:

```bash
# =============================================================================
# Frontend Environment Variables for Render.com
# =============================================================================

# WalletConnect (must match backend)
REACT_APP_WALLETCONNECT_PROJECT_ID=same_as_backend_32_char_id
VITE_WALLETCONNECT_PROJECT_ID=same_as_backend_32_char_id

# Cloudinary
REACT_APP_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name

# API
REACT_APP_API_URL=https://your-backend.onrender.com
VITE_API_URL=https://your-backend.onrender.com

# Network
REACT_APP_NETWORK=mainnet
VITE_NETWORK=mainnet
REACT_APP_CHAIN_ID=56
VITE_CHAIN_ID=56

# Features
REACT_APP_ENABLE_DEBUG=false
VITE_ENABLE_DEBUG=false
REACT_APP_ENABLE_ANALYTICS=true
VITE_ENABLE_ANALYTICS=true
```

---

## Post-Deployment

### Step 1: Verify Backend Health

```bash
# Health check endpoint
curl https://bnbmarket-backend.onrender.com/api/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2025-10-08T12:00:00.000Z"
}
```

### Step 2: Test Database Connection

Check logs in Render dashboard for:
```
✓ Connected to PostgreSQL database
✓ Database migrations completed
✓ Server started on port 10000
```

### Step 3: Configure Custom Domain (Optional)

1. **Backend Custom Domain**
   - Go to backend service → **"Settings"**
   - Scroll to **"Custom Domain"**
   - Add: `api.bnbmarket.cc`
   - Follow DNS configuration instructions

2. **Frontend Custom Domain**
   - Go to static site → **"Settings"**
   - Add: `bnbmarket.cc` or `www.bnbmarket.cc`
   - Configure DNS:
     ```
     Type: CNAME
     Name: @ (or www)
     Value: your-app.onrender.com
     ```

### Step 4: Update CORS Settings

If using custom domain, update allowed origins in `server.js`:

```javascript
const allowedOrigins = [
  'https://bnbmarket.cc',
  'https://www.bnbmarket.cc',
  'https://bnbmarket-frontend.onrender.com',
  // ... existing origins
];
```

Redeploy after updating.

### Step 5: Enable Monitoring

1. **Render Dashboard Alerts**
   - Go to service → **"Settings"** → **"Alerts"**
   - Enable: Health check failures, high memory, high CPU

2. **Cloudinary Usage**
   - Set up usage alerts: https://cloudinary.com/console/settings/notifications

3. **WalletConnect Analytics**
   - Monitor at: https://cloud.walletconnect.com/

---

## Troubleshooting

### Build Failures

**Problem:** Build fails with "Module not found"
```bash
Solution:
1. Check package.json dependencies
2. Ensure build command includes: npm install
3. Clear build cache: Settings → Clear Build Cache
```

**Problem:** Environment variables not accessible
```bash
Solution:
1. Verify variable names (REACT_APP_ or VITE_ prefix for frontend)
2. Restart service after adding env vars
3. Check logs for environment variable issues
```

### Runtime Errors

**Problem:** "Cannot connect to database"
```bash
Solution:
1. Verify DATABASE_URL is set correctly
2. Check database status (green in dashboard)
3. Ensure SSL is configured: ?ssl=true or ?sslmode=require
```

**Problem:** CORS errors in browser console
```bash
Solution:
1. Add frontend URL to allowedOrigins in server.js
2. Ensure CORS middleware is before routes
3. Verify API_URL in frontend .env matches backend URL
```

**Problem:** WalletConnect not connecting
```bash
Solution:
1. Verify Project ID is correct (32 chars)
2. Check project is active in WalletConnect dashboard
3. Ensure ID matches in both frontend and backend
4. Check browser console for specific error messages
```

### Database Issues

**Problem:** Migrations not running
```bash
Solution:
1. Check logs for migration errors
2. Manually run migrations: Add build command
   npm install && node run-all-migrations.js
3. Verify DATABASE_URL has correct permissions
```

**Problem:** "Too many connections"
```bash
Solution:
1. Upgrade database plan (free tier = 10 connections)
2. Reduce connection pool size in code
3. Enable connection pooling in DATABASE_URL
```

### Performance Issues

**Problem:** Cold starts (first request slow)
```bash
Solution:
- Upgrade from Free to Starter plan ($7/month)
- Free tier spins down after 15 min inactivity
- Starter tier = always on, no cold starts
```

**Problem:** Slow API responses
```bash
Solution:
1. Enable database connection pooling
2. Add caching (Redis on Render)
3. Optimize database queries
4. Consider CDN for static assets
```

---

## Environment Variable Checklist

Use this checklist when setting up Render deployment:

### Backend Checklist
- [ ] `NODE_ENV=production`
- [ ] `PORT=10000`
- [ ] `DATABASE_URL` (from Render PostgreSQL)
- [ ] `ADMIN_WALLET` (your wallet address)
- [ ] `BSC_RPC_URL` (BSC node URL)
- [ ] `CLOUDINARY_URL` (from Cloudinary dashboard)
- [ ] `WALLETCONNECT_PROJECT_ID` (from WalletConnect Cloud)
- [ ] `RECAPTCHA_SECRET_KEY` (from Google reCAPTCHA)
- [ ] `RECAPTCHA_THRESHOLD=0.5`
- [ ] `EARLY_UNSTAKING_FEE_PERCENTAGE=0.05`
- [ ] `TRANSACTION_FEE_PERCENTAGE=0.01`

### Frontend Checklist
- [ ] `REACT_APP_WALLETCONNECT_PROJECT_ID` (same as backend)
- [ ] `VITE_WALLETCONNECT_PROJECT_ID` (same as backend)
- [ ] `REACT_APP_CLOUDINARY_CLOUD_NAME`
- [ ] `VITE_CLOUDINARY_CLOUD_NAME`
- [ ] `REACT_APP_API_URL` (backend URL)
- [ ] `VITE_API_URL` (backend URL)
- [ ] `REACT_APP_NETWORK=mainnet`
- [ ] `VITE_NETWORK=mainnet`
- [ ] `REACT_APP_CHAIN_ID=56`
- [ ] `VITE_CHAIN_ID=56`

### Database Checklist
- [ ] PostgreSQL database created
- [ ] Database connected to web service
- [ ] Migrations completed successfully
- [ ] Test query executed successfully

### Post-Deployment Checklist
- [ ] Backend health endpoint returns 200
- [ ] Frontend loads without errors
- [ ] WalletConnect connection works
- [ ] Image uploads work (Cloudinary)
- [ ] Database operations work
- [ ] CORS configured correctly
- [ ] Custom domains configured (if applicable)
- [ ] Monitoring/alerts enabled
- [ ] SSL certificates active (automatic on Render)

---

## Quick Reference Commands

### Check Backend Status
```bash
curl https://your-backend.onrender.com/api/health
```

### View Logs
```bash
# In Render Dashboard
1. Go to your service
2. Click "Logs" tab
3. Use search to filter: "error", "warn", etc.
```

### Restart Service
```bash
# In Render Dashboard
1. Go to service
2. Click "Manual Deploy"
3. Select "Clear build cache & deploy"
```

### Update Environment Variable
```bash
# In Render Dashboard
1. Go to service → Environment
2. Edit variable value
3. Service automatically redeploys
```

---

## Security Best Practices

1. **Never commit `.env` files** - Already configured in `.gitignore`
2. **Rotate credentials quarterly** - Set calendar reminder
3. **Use HTTPS only** - Enforced by Render automatically
4. **Enable Render's DDoS protection** - Free on all plans
5. **Monitor logs for suspicious activity** - Set up alerts
6. **Keep dependencies updated** - Run `npm audit` regularly
7. **Use strong database passwords** - Render generates these
8. **Enable 2FA on all accounts** - Render, GitHub, Cloudinary, WalletConnect

---

## Cost Estimate

### Free Tier (Suitable for Development/Testing)
- **Web Service**: Free (spins down after 15 min inactivity)
- **PostgreSQL**: Free (1GB storage, 10 connections)
- **Static Site**: Free (100GB bandwidth/month)
- **Total**: $0/month

### Starter Tier (Recommended for Production)
- **Web Service**: $7/month (always on, no cold starts)
- **PostgreSQL**: $7/month (10GB storage, 100 connections)
- **Static Site**: Free (100GB bandwidth)
- **Total**: $14/month

### Production Tier (High Traffic)
- **Web Service**: $25/month (2GB RAM, 2 CPU)
- **PostgreSQL**: $15/month (100GB storage, unlimited connections)
- **Static Site**: Free or $1/month for custom domain
- **Total**: $40-41/month

---

## Support & Resources

- **Render Documentation**: https://render.com/docs
- **Render Community**: https://community.render.com/
- **GitHub Issues**: https://github.com/HarryPottersBalls/BNBMARKET/issues
- **WalletConnect Docs**: https://docs.walletconnect.com/
- **Cloudinary Docs**: https://cloudinary.com/documentation

---

## Next Steps

After successful deployment:

1. ✅ Test all functionality thoroughly
2. ✅ Set up monitoring and alerts
3. ✅ Configure custom domain
4. ✅ Enable Render's free SSL
5. ✅ Document any deployment issues
6. ✅ Share URLs with team
7. ✅ Set up staging environment (optional)
8. ✅ Plan credential rotation schedule

---

**Last Updated:** October 8, 2025
**Render Version:** Latest
**Node Version:** LTS (v18 or v20 recommended)

For questions or issues, check the troubleshooting section or create an issue on GitHub.
