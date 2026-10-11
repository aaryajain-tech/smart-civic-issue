# 🔒 Environment Variables Security Guide

## ⚠️ IMPORTANT: Never commit actual environment variables to Git!

### What's Protected:
- ✅ `.env` files are in `.gitignore` 
- ✅ Only `.env.example` files with placeholders are committed
- ✅ Actual secrets stay local and in deployment platforms

### Setup Instructions:

#### 1. Local Development
```bash
# Copy example files and add your actual values
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit the .env files with your actual keys
# These files are ignored by Git
```

#### 2. Get Your Supabase Keys
1. Go to [supabase.com](https://supabase.com)
2. Open your project dashboard
3. Go to Settings → API
4. Copy your Project URL and anon/public key

#### 3. Update Local .env Files
Replace placeholders in your local `.env` files:
```bash
# backend/.env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-actual-anon-key

# frontend/.env  
REACT_APP_API_URL=http://localhost:5000/api
```

#### 4. Deployment Environment Variables
Set these in your deployment platforms:
- **Render**: Project Settings → Environment Variables
- **Vercel**: Project Settings → Environment Variables

### 🚨 If You Accidentally Committed Secrets:
1. **Immediately rotate your keys** in Supabase dashboard
2. Remove secrets from Git history:
   ```bash
   git rm --cached backend/.env
   git commit -m "Remove sensitive environment file"
   ```
3. Update deployment platforms with new keys

### 📝 Files Safe to Commit:
- ✅ `.env.example` (with placeholders)
- ✅ `.gitignore` 
- ✅ `DEPLOYMENT.md`
- ❌ `.env` (actual secrets)

### 🔍 Before Pushing to Git:
```bash
# Check what you're about to commit
git status
git diff --cached

# Ensure no .env files are staged
git ls-files --cached | grep "\.env$"
# This should return nothing
```