#!/bin/bash
set -e # Exit on error

# Configuration
PEM_FILE="../linux_av.pem"
EC2_HOST="ubuntu@ec2-3-111-41-254.ap-south-1.compute.amazonaws.com"
REMOTE_DIR="~/erp-frontend-git"
DOMAIN="school.edulekha.in"
EMAIL="admin@edulekha.in"

echo "Starting Deployment to $DOMAIN on $EC2_HOST..."

# 1. Install Docker & Compose (if missing)
echo "Ensuring Docker is installed..."
ssh -i "$PEM_FILE" -o StrictHostKeyChecking=no "$EC2_HOST" << EOF
    if ! command -v docker &> /dev/null; then
        echo "Installing Docker..."
        sudo apt-get update
        sudo apt-get install -y ca-certificates curl
        sudo install -m 0755 -d /etc/apt/keyrings
        sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
        sudo chmod a+r /etc/apt/keyrings/docker.asc
        echo "deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \$(. /etc/os-release && echo \"\$VERSION_CODENAME\") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        sudo apt-get update
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        sudo usermod -aG docker \$USER
    fi
    
    # Check if 'docker compose' works, if not install standalone
    if ! sudo docker compose version &> /dev/null; then
        echo "Installing standalone Docker Compose..."
        sudo curl -SL https://github.com/docker/compose/releases/download/v2.29.1/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose || true
    fi
EOF

# 2. Reset EC2 (Stop containers and remove directory)
echo "Resetting EC2 instance..."
ssh -i "$PEM_FILE" "$EC2_HOST" << EOF
    # Determine command
    if sudo docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="sudo docker compose"
    else
        DOCKER_COMPOSE_CMD="sudo docker-compose"
    fi
    echo "Using: \$DOCKER_COMPOSE_CMD"

    # Try to stop containers
    # Stop containers without removing volumes
    \$DOCKER_COMPOSE_CMD down || true
    # Do NOT remove volumes (-v) to persist database
    # \$DOCKER_COMPOSE_CMD down -v || true
    echo "Removing old files..."
    rm -rf $REMOTE_DIR
    mkdir -p $REMOTE_DIR
EOF

# 3. Copy Files
echo "Copying files to EC2..."
scp -i "$PEM_FILE" -r ./.dockerignore ./Dockerfile ./Dockerfile.backup ./docker-compose.yml ./nginx.conf ./nginx.conf.ssl ./package.json ./package-lock.json ./tsconfig.json ./vite.config.ts ./postcss.config.js ./tailwind.config.ts ./backup.sh ./client ./server ./shared "$EC2_HOST:$REMOTE_DIR"

# 4. Setup Environment and Start HTTP
echo "Setting up environment and starting HTTP..."
ssh -i "$PEM_FILE" "$EC2_HOST" << EOF
    cd $REMOTE_DIR
    
    # Determine command
    if sudo docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="sudo docker compose"
    else
        DOCKER_COMPOSE_CMD="sudo docker-compose"
    fi

    # Create .env file
    cat << EOT > .env
DATABASE_URL=postgresql://school_erp:school_erp_pass@postgres:5432/school_erp
PORT=5000
NODE_ENV=production
SESSION_SECRET=super_secret_school_erp_key
SESSION_SECURE=true
SUPER_ADMIN_EMAIL=av512406@school.com
SUPER_ADMIN_PASSWORD=Anand@8520#
AWS_REGION=ap-south-1
S3_BUCKET_NAME=schoolerpbackupmultiuser
POSTGRES_USER=school_erp
POSTGRES_PASSWORD=school_erp_pass
POSTGRES_DB=school_erp
EOT

    # Start Nginx (HTTP only first)
    echo "Starting Docker containers..."
    \$DOCKER_COMPOSE_CMD up -d --build
EOF

echo "Waiting for Nginx to start..."
sleep 15

# 5. SSL Setup with Certbot
echo "Requesting SSL Certificate..."
ssh -i "$PEM_FILE" "$EC2_HOST" << EOF
    cd $REMOTE_DIR
    # Determine command
    if sudo docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="sudo docker compose"
    else
        DOCKER_COMPOSE_CMD="sudo docker-compose"
    fi

    # Run certbot
    \$DOCKER_COMPOSE_CMD run --rm certbot certonly --webroot --webroot-path /var/www/certbot -d $DOMAIN --email $EMAIL --agree-tos --no-eff-email
EOF

# 6. Enable HTTPS in Nginx
echo "Enabling HTTPS..."
ssh -i "$PEM_FILE" "$EC2_HOST" << EOF
    cd $REMOTE_DIR
    # Determine command
    if sudo docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="sudo docker compose"
    else
        DOCKER_COMPOSE_CMD="sudo docker-compose"
    fi

    # Swap config files
    mv nginx.conf.ssl nginx.conf
    
    # Restart Nginx to apply changes
    \$DOCKER_COMPOSE_CMD restart nginx
EOF

echo "Deployment Complete! Access at https://$DOMAIN"

