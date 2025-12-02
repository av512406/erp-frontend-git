#!/bin/bash
set -e

# Configuration
PEM_FILE="../linux_av.pem"
EC2_HOST="ubuntu@ec2-3-111-41-254.ap-south-1.compute.amazonaws.com"
REMOTE_DIR="~/erp-frontend-git"
DOMAIN="school.edulekha.in"
EMAIL="admin@edulekha.in"

echo "Setting up SSL on $EC2_HOST..."

# Copy nginx.conf.ssl to server just in case it's missing or old
scp -i "$PEM_FILE" nginx.conf.ssl "$EC2_HOST:$REMOTE_DIR/nginx.conf.ssl"

ssh -i "$PEM_FILE" "$EC2_HOST" << EOF
    cd $REMOTE_DIR
    
    # Determine command
    if sudo docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="sudo docker compose"
    else
        DOCKER_COMPOSE_CMD="sudo docker-compose"
    fi

    echo "Requesting SSL Certificate..."
    # Run certbot
    \$DOCKER_COMPOSE_CMD run --rm certbot certonly --webroot --webroot-path /var/www/certbot -d $DOMAIN --email $EMAIL --agree-tos --no-eff-email

    echo "Enabling HTTPS..."
    # Swap config files
    cp nginx.conf.ssl nginx.conf
    
    # Restart Nginx to apply changes
    \$DOCKER_COMPOSE_CMD restart nginx
EOF

echo "SSL Setup Complete!"
