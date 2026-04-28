# 📡 Hosting & Deployment Guide

This guide explains how to deploy the **Irrigation Hub Studio** to a live production environment.

## 1. Database Setup (MongoDB Atlas)
1. Create a free account on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a new Cluster and a Database.
3. Go to **Network Access** and allow access from `0.0.0.0/0` (or the IP of your hosting provider).
4. Go to **Database Access** and create a user with read/write permissions.
5. Get your **Connection String** (URI).

## 2. Deployment (Render.com) - RECOMMENDED
We have included a `render.yaml` file for "Blueprint" deployments.

1. Create a [Render](https://render.com/) account.
2. Click **New +** and select **Blueprint**.
3. Connect your GitHub repository.
4. Render will automatically detect the `render.yaml` and configure the service.
5. **CRITICAL**: Go to the **Environment** tab in Render and add the following keys:
   - `MONGO_URI`: Your MongoDB Atlas connection string.
   - `JWT_SECRET`: A long, random string for security.
   - `VAPID_PUBLIC_KEY`: Your Web Push public key.
   - `VAPID_PRIVATE_KEY`: Your Web Push private key.
6. Click **Deploy**.

## 3. GitHub Push Instructions
To push your local code to your GitHub repository:

```bash
# Initialize git (if not done)
git init

# Add the remote repository
git remote add origin https://github.com/Purujeet-git/Test_Python.git

# Stage all changes
git add .

# Commit
git commit -m "chore: prepare for production deployment"

# Push to main branch
git branch -M main
git push -u origin main
```

## 4. Environment Variables Checklist
Ensure these are set in your production environment (DO NOT push `.env` to GitHub):
- `MONGO_URI`
- `JWT_SECRET`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `PORT` (Render sets this automatically)
