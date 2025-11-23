#!/bin/bash

# Exit on error
set -e

echo "Starting School ERP EC2 Setup..."

# 1. Update System
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20
echo "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install PM2 (Process Manager)
echo "Installing PM2..."
sudo npm install -g pm2

# 4. Install Nginx
echo "Installing Nginx..."
sudo apt install -y nginx

# 5. Install Certbot (SSL)
echo "Installing Certbot..."
sudo apt install -y certbot python3-certbot-nginx

# 6. Setup Directory
echo "Setting up application directory..."
sudo mkdir -p /srv/school-erp
sudo chown -R $USER:$USER /srv/school-erp

# 7. Create Nginx Config
echo "Configuring Nginx..."
# Use first argument as domain, or prompt if not provided
DOMAIN_NAME=$1
if [ -z "$DOMAIN_NAME" ]; then
    read -p "Enter your domain name (e.g., api.yourschool.com): " DOMAIN_NAME
fi

if [ -z "$DOMAIN_NAME" ]; then
    echo "Error: Domain name is required."
    exit 1
fi

sudo tee /etc/nginx/sites-available/school-erp > /dev/null <<EOF
server {
    server_name $DOMAIN_NAME;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/school-erp /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo "Setup complete! Next steps:"
echo "1. Clone your repository into /srv/school-erp"
echo "2. Create .env file with DATABASE_URL and other secrets"
echo "3. Run 'npm install' and 'npm run build'"
echo "4. Start app with 'pm2 start dist/index.js --name school-erp'"
echo "5. Run 'sudo certbot --nginx -d $DOMAIN_NAME' to enable SSL"
