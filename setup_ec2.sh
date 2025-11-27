#!/bin/bash

# EC2 Setup & Deployment Script
# Usage: ./setup_ec2.sh

echo "🚀 Starting EC2 Setup..."

# 1. Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=\"$(dpkg --print-architecture)\" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker $USER
    echo "✅ Docker installed. You may need to logout and login again for group changes."
else
    echo "✅ Docker is already installed."
fi

# 2. Pull Latest Code
echo "⬇️ Pulling latest code..."
git pull origin DOCKER

# 3. Start Application
echo "🚀 Starting application..."
# Build and start containers
docker compose up -d --build

echo "✅ Deployment Complete! Access your app at http://$(curl -s ifconfig.me)"
