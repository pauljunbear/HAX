#!/bin/bash

# Auto-deploy script for Imager
# This script automatically commits changes and pushes to GitHub,
# which triggers Vercel deployments

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}===== 🚀 Imager Auto-Deploy =====${NC}"
echo -e "${YELLOW}Starting deployment process...${NC}"

# Check for uncommitted changes
echo -e "${BLUE}> Checking Git status...${NC}"
if [[ -z $(git status -s) ]]; then
  echo -e "${YELLOW}No changes detected. Nothing to deploy.${NC}"
  exit 0
fi

# Show what will be committed
echo -e "${BLUE}> Changes to be deployed:${NC}"
git status -s

# Stage all changes
echo -e "${BLUE}> Staging changes...${NC}"
git add .

# Commit with timestamp
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
echo -e "${BLUE}> Committing changes...${NC}"
git commit -m "Auto-deploy: ${TIMESTAMP}"

# Push to remote
echo -e "${BLUE}> Pushing to GitHub...${NC}"
if git push; then
  echo -e "${GREEN}✅ Changes pushed successfully! Vercel deployment should start automatically.${NC}"
  echo -e "${YELLOW}Check your Vercel dashboard for deployment status.${NC}"
else
  echo -e "${RED}❌ Error pushing changes to GitHub. Please check your connection and try again.${NC}"
  exit 1
fi

echo -e "${BLUE}===== 🎉 Deployment process completed =====${NC}" 