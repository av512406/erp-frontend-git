# EC2 Reset and Docker Setup Guide

This guide documents the steps to reset the EC2 instance, copy the source code, build the Docker image, and deploy the School ERP application.

## Prerequisites
- SSH Access to the EC2 instance (PEM file required).
- Docker and Docker Compose installed on the EC2 instance.
- Local source code.

## 1. Connect to EC2 (Verification)
```bash
ssh -i "linux_av.pem" ubuntu@ec2-3-111-41-254.ap-south-1.compute.amazonaws.com
```

## 2. Reset Docker Environment
**WARNING: This will delete all containers, images, and volumes (database data).**

```bash
ssh -i "linux_av.pem" ubuntu@ec2-3-111-41-254.ap-south-1.compute.amazonaws.com << 'EOF'
docker stop $(docker ps -aq) || true
docker rm $(docker ps -aq) || true
docker volume prune -f
docker network prune -f
# docker rmi $(docker images -q) # Optional
EOF
```

## 3. Prepare and Copy Source Code
Create a compressed archive of the project, excluding unnecessary files.

```bash
# Create tarball
tar --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='.env' -czf school_erp.tar.gz .

# Copy to EC2
scp -i "linux_av.pem" school_erp.tar.gz ubuntu@ec2-3-111-41-254.ap-south-1.compute.amazonaws.com:~/
```

## 4. Setup and Build on EC2
```bash
ssh -i "linux_av.pem" ubuntu@ec2-3-111-41-254.ap-south-1.compute.amazonaws.com << 'EOF'
# Setup directory
rm -rf school_erp
mkdir -p school_erp
tar -xzf school_erp.tar.gz -C school_erp
cd school_erp

# Build Docker Image
docker build -t sshatru/erp:latest .

# Create nginx.conf (if not in repo)
cat << 'NGINX' > nginx.conf
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
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
NGINX

# Update docker-compose.yml to use local build or image
# (Assuming docker-compose.yml is in the repo and uses sshatru/erp:latest)

# Start Application
docker-compose up -d
EOF
```

## 5. Verify Deployment
```bash
ssh -i "linux_av.pem" ubuntu@ec2-3-111-41-254.ap-south-1.compute.amazonaws.com "docker ps"
```
