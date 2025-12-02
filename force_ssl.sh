#!/bin/bash
PEM_FILE="../linux_av.pem"
EC2_HOST="ubuntu@ec2-3-111-41-254.ap-south-1.compute.amazonaws.com"
REMOTE_DIR="~/erp-frontend-git"

ssh -i "$PEM_FILE" "$EC2_HOST" << EOF
    cd $REMOTE_DIR
    echo "Forcing config swap..."
    cp -f nginx.conf.ssl nginx.conf
    
    echo "Restarting Nginx..."
    if sudo docker compose version &> /dev/null; then
        sudo docker compose restart nginx
    else
        sudo docker-compose restart nginx
    fi
EOF
