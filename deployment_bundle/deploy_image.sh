#!/bin/bash
set -e

# Configuration
PEM_FILE="./linux_av.pem"
EC2_HOST="ubuntu@ec2-3-111-41-254.ap-south-1.compute.amazonaws.com"
REMOTE_DIR="~/erp-frontend-git"
IMAGE_FILE="school_erp_latest.tar"

echo "Deploying pre-built image to $EC2_HOST..."

# 1. Modify docker-compose.yml to use image instead of build
# We use sed to uncomment image and comment build
sed -i 's/build: ./# build: ./g' docker-compose.yml
sed -i 's/# image: sshatru\/erp:latest/image: sshatru\/erp:latest/g' docker-compose.yml

# 2. Copy files
echo "Copying image and config to EC2..."
scp -i "$PEM_FILE" "$IMAGE_FILE" docker-compose.yml "$EC2_HOST:$REMOTE_DIR/"

# 3. Revert docker-compose.yml changes locally
sed -i 's/# build: ./build: ./g' docker-compose.yml
sed -i 's/image: sshatru\/erp:latest/# image: sshatru\/erp:latest/g' docker-compose.yml

# 4. SSH and Deploy
echo "Loading image and restarting containers on EC2..."
ssh -i "$PEM_FILE" "$EC2_HOST" << EOF
    cd $REMOTE_DIR
    
    # Load the image
    echo "Loading Docker image..."
    sudo docker load -i $IMAGE_FILE
    
    # Determine command
    if sudo docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="sudo docker compose"
    else
        DOCKER_COMPOSE_CMD="sudo docker-compose"
    fi

    # Restart containers
    echo "Restarting containers..."
    \$DOCKER_COMPOSE_CMD down
    \$DOCKER_COMPOSE_CMD up -d
    
    # Clean up image file to save space
    rm $IMAGE_FILE
EOF

echo "Deployment Complete!"
