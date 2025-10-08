# 🚨 URGENT: Credential Rotation Required

**Status:** CRITICAL SECURITY ISSUE
**Date Discovered:** October 8, 2025
**Priority:** IMMEDIATE ACTION REQUIRED

---

## Overview

During the production readiness audit, **exposed credentials were discovered in the Git repository**. These credentials must be rotated immediately to prevent unauthorized access.

---

## Exposed Credentials

The following credentials were found exposed in `.env` file (committed to Git):

### 1. Cloudinary Credentials
**File:** `.env` (line 1)
**Exposed:**
```
CLOUDINARY_URL=cloudinary://219589676836777:S45sa9mTwUdXUYe6_E-0FH3Rxs8@dmguxj9gy
```

**Components:**
- API Key: `219589676836777`
- API Secret: `S45sa9mTwUdXUYe6_E-0FH3Rxs8`
- Cloud Name: `dmguxj9gy`

**Risk:** Unauthorized access to image storage, potential data breach, resource abuse

### 2. WalletConnect Project ID
**File:** `.env` (line 1)
**Exposed:**
```
WALLETCONNECT_PROJECT_ID=7892436780edf7051b80242c141989ed
```

**Risk:** Unauthorized dApp connections, potential phishing attacks

---

## Immediate Actions Required

### ✅ Step 1: Rotate Cloudinary Credentials (DO THIS NOW)

1. **Login to Cloudinary Console:**
   ```
   https://cloudinary.com/console/settings/security
   ```

2. **Reset API Credentials:**
   - Navigate to Security → Access Keys
   - Click "Regenerate" next to API Secret
   - Save the new credentials securely

3. **Update Environment Variables:**
   ```bash
   # In your .env file (NOT committed to Git!)
   CLOUDINARY_URL=cloudinary://[NEW_API_KEY]:[NEW_API_SECRET]@dmguxj9gy
   ```

4. **Update Production Environment:**
   - Update credentials in your hosting platform (Render, Heroku, etc.)
   - Restart all services

### ✅ Step 2: Rotate WalletConnect Project ID

1. **Create New Project:**
   ```
   https://cloud.walletconnect.com/
   ```

2. **Delete Old Project:**
   - Navigate to the old project with ID `7892436780edf7051b80242c141989ed`
   - Click "Delete Project"
   - Confirm deletion

3. **Update Environment Variables:**
   ```bash
   # In your .env file
   WALLETCONNECT_PROJECT_ID=[NEW_PROJECT_ID]
   ```

4. **Update Production Environment:**
   - Update in hosting platform
   - Update in any documentation
   - Restart all services

### ✅ Step 3: Clean Git History

**WARNING:** This will rewrite Git history. Coordinate with your team before proceeding.

#### Option A: Using BFG Repo-Cleaner (Recommended)

1. **Install BFG:**
   ```bash
   brew install bfg  # macOS
   # Or download from: https://rtyley.github.io/bfg-repo-cleaner/
   ```

2. **Clone a fresh copy:**
   ```bash
   git clone --mirror git@github.com:yourusername/bnbmarket.git bnbmarket-mirror.git
   cd bnbmarket-mirror.git
   ```

3. **Remove .env files from history:**
   ```bash
   bfg --delete-files .env
   bfg --delete-files "*.env"
   ```

4. **Clean up:**
   ```bash
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   ```

5. **Force push:**
   ```bash
   git push --force
   ```

#### Option B: Using git-filter-repo

1. **Install git-filter-repo:**
   ```bash
   pip install git-filter-repo
   ```

2. **Remove .env from history:**
   ```bash
   git filter-repo --path .env --invert-paths
   git filter-repo --path .env.production --invert-paths
   ```

3. **Force push:**
   ```bash
   git push --force --all
   ```

### ✅ Step 4: Verify .gitignore

Already completed ✓ - `.gitignore` has been created with proper exclusions.

Verify it's working:
```bash
# This should show .env is ignored
git status

# This should NOT show .env
git check-ignore -v .env
```

---

## Post-Rotation Verification

### Checklist

- [ ] Cloudinary API secret rotated
- [ ] New Cloudinary credentials tested and working
- [ ] WalletConnect project ID rotated
- [ ] Old WalletConnect project deleted
- [ ] All production environments updated
- [ ] All development team members notified
- [ ] Git history cleaned (BFG or git-filter-repo)
- [ ] Force push completed
- [ ] All team members re-cloned repository
- [ ] `.env` file confirmed in `.gitignore`
- [ ] Verified `.env` not tracked: `git status` shows nothing
- [ ] Services restarted and tested
- [ ] Monitoring for unauthorized access attempts

---

## Prevention: Secure Environment Variable Management

### Development Environment

1. **Never commit `.env` files:**
   ```bash
   # Already added to .gitignore
   .env
   .env.*
   *.env
   ```

2. **Use `.env.example` for documentation:**
   ```env
   # .env.example - Safe to commit
   CLOUDINARY_URL=cloudinary://YOUR_KEY:YOUR_SECRET@YOUR_CLOUD_NAME
   WALLETCONNECT_PROJECT_ID=your_project_id_here
   ```

3. **Use environment variable validation:**
   Add to your server startup:
   ```javascript
   // In server.js or config/environment.js
   const requiredEnvVars = [
     'DATABASE_URL',
     'CLOUDINARY_URL',
     'WALLETCONNECT_PROJECT_ID',
     'ADMIN_WALLET'
   ];

   requiredEnvVars.forEach(varName => {
     if (!process.env[varName]) {
       throw new Error(`Missing required environment variable: ${varName}`);
     }
   });
   ```

### Production Environment

1. **Use Secrets Management:**
   - **Render:** Use Environment Variables (encrypted at rest)
   - **AWS:** Use AWS Secrets Manager
   - **Azure:** Use Azure Key Vault
   - **GCP:** Use Secret Manager
   - **Docker:** Use Docker Secrets

2. **Enable Secret Scanning:**
   - GitHub: Enable secret scanning in repository settings
   - GitLab: Enable Secret Detection in CI/CD
   - Use tools like:
     - `truffleHog`
     - `git-secrets`
     - `gitleaks`

3. **Implement Rotation Policy:**
   - Rotate credentials every 90 days
   - Rotate immediately if:
     - Employee leaves
     - Credential exposure suspected
     - Security breach detected

---

## Monitoring for Compromise

### Check Cloudinary Usage

1. **Login to Cloudinary Dashboard:**
   ```
   https://cloudinary.com/console/
   ```

2. **Review Recent Activity:**
   - Check "Usage" tab for unusual spikes
   - Review "Transformations" for unauthorized operations
   - Check "Media Library" for unexpected uploads

3. **Set up Alerts:**
   - Configure usage alerts
   - Enable API call monitoring

### Check WalletConnect Usage

1. **Login to WalletConnect Dashboard:**
   ```
   https://cloud.walletconnect.com/
   ```

2. **Review Analytics:**
   - Check connection attempts
   - Review geographic distribution
   - Look for unusual patterns

---

## Communication Template

Use this template to notify your team:

```
Subject: URGENT: Security Credential Rotation Required

Team,

During our production readiness audit, we discovered that sensitive credentials
were accidentally committed to our Git repository.

IMMEDIATE ACTIONS REQUIRED:

1. DO NOT pull from the repository until further notice
2. All Cloudinary and WalletConnect credentials have been rotated
3. Git history will be rewritten - you will need to re-clone

Timeline:
- [NOW]: Credentials rotated
- [TODAY]: Git history cleaned
- [TODAY]: Force push completed
- [TOMORROW]: Everyone re-clones repository

New credentials are available in [YOUR_SECRETS_MANAGER].

Please confirm receipt of this message.

Security Team
```

---

## Additional Security Measures

### 1. Enable 2FA Everywhere

- [ ] Cloudinary account 2FA
- [ ] GitHub account 2FA (all team members)
- [ ] WalletConnect account 2FA
- [ ] Hosting platform 2FA

### 2. Implement Pre-commit Hooks

Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash

# Check for potential secrets
if git diff --cached | grep -E "(api[_-]key|api[_-]secret|password|token|private[_-]key)" -i; then
    echo "⚠️  WARNING: Potential secret detected in commit!"
    echo "Please review your changes carefully."
    exit 1
fi

# Check if .env is being committed
if git diff --cached --name-only | grep -q "^\.env$"; then
    echo "🚫 ERROR: Attempting to commit .env file!"
    echo "Please remove .env from staging: git reset HEAD .env"
    exit 1
fi
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

### 3. Use Secret Scanning Tools

Install and run regularly:
```bash
# Install gitleaks
brew install gitleaks

# Scan repository
gitleaks detect --source . --verbose

# Scan specific files
gitleaks detect --source .env --verbose
```

---

## Compliance Considerations

If your application handles:
- **Financial data:** Report breach to regulatory bodies
- **User PII:** May require user notification (GDPR, CCPA)
- **Healthcare data:** HIPAA breach notification required

Consult with legal counsel if applicable.

---

## Resources

- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_CheatSheet.html)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [git-filter-repo](https://github.com/newren/git-filter-repo)

---

**Document Status:** Active
**Last Updated:** October 8, 2025
**Next Review:** After credential rotation completed
