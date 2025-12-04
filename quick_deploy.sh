#!/bin/bash
set -e

PEM_FILE="../linux_av.pem"
EC2_HOST="ubuntu@ec2-3-111-41-254.ap-south-1.compute.amazonaws.com"
REMOTE_DIR="~/erp-frontend-git"

echo "Deploying to $EC2_HOST..."

# Sync files using rsync
# Exclude heavy/unnecessary files
rsync -avz -e "ssh -i $PEM_FILE -o StrictHostKeyChecking=no" \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'dist' \
    --exclude '.env' \
    --exclude '.DS_Store' \
    --exclude '*.tar' \
    --exclude '*.tar.gz' \
    --exclude '*.zip' \
    --exclude 'db_backups' \
    --exclude 'certbot' \
    --exclude 'nginx.conf' \
    --exclude 'nginx.conf.ssl' \
    ./ "$EC2_HOST:$REMOTE_DIR"

# Restart containers on EC2
ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no "$EC2_HOST" << EOF
    cd $REMOTE_DIR
    
    # Determine docker compose command
    if sudo docker compose version &> /dev/null; then
        CMD="sudo docker compose"
    else
        CMD="sudo docker-compose"
    fi
    
    echo "Rebuilding and restarting containers..."
    # Build and start in detached mode
    # This will recreate containers with the new image but keep volumes
    \$CMD up -d --build --remove-orphans
    
    echo "Pruning old images..."
    sudo docker image prune -f
EOF

echo "Deployment complete."
