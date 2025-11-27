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

# 2. Reset / Cleanup (Optional)
echo "🧹 Cleaning up old containers..."
docker compose down --remove-orphans || true
docker system prune -f # Free up space

# 3. Create Configuration Files
echo "📝 Creating configuration files..."

# docker-compose.yml
cat > docker-compose.yml <<EOL
services:
  app:
    image: sshatru/erp:latest
    container_name: school_erp_app
    environment:
      - DATABASE_URL=postgres://school_erp:school_erp_pass@postgres:5432/school_erp
      - PORT=5000
      - NODE_ENV=production
    depends_on:
      postgres:
        condition: service_healthy
    restart: always

  nginx:
    image: nginx:alpine
    container_name: school_erp_nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      # - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - app
    restart: always

  postgres:
    image: postgres:16
    container_name: school_erp_db
    environment:
      POSTGRES_USER: school_erp
      POSTGRES_PASSWORD: school_erp_pass
      POSTGRES_DB: school_erp
    ports:
      - "15432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U school_erp"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
EOL

# nginx.conf
cat > nginx.conf <<EOL
events {
    worker_connections 1024;
}

http {
    server {
        listen 80;
        server_name localhost;

        location / {
            proxy_pass http://app:5000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_cache_bypass \$http_upgrade;
        }
    }
}
EOL

# 4. Start Application
echo "🚀 Starting application..."
docker compose pull
docker compose up -d

echo "✅ Deployment Complete! Access your app at http://\$(curl -s ifconfig.me)"
