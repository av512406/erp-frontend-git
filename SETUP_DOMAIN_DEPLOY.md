# EC2 Reset and Docker Setup Guide
**Domain:** `school1.edulekha.in`

This guide documents the steps to deploy the School ERP application on AWS EC2.

## Prerequisites
- **EC2 Instance**: Ubuntu 22.04 LTS.
- **Security Group**: Allow TCP ports 22 (SSH), 80 (HTTP), 443 (HTTPS).
- **DNS**: Point `A Record` for `school1.edulekha.in` to your EC2 Public IP.

## 1. Connect to EC2
```bash
ssh -i "your-key.pem" ubuntu@<EC2-Public-IP>
```

## 2. Prepare Environment (One-time Setup)
Run these commands on the EC2 instance to install Docker and Nginx:
```bash
# Update and install Docker
sudo apt update
sudo apt install -y docker.io docker-compose git nginx certbot python3-certbot-nginx

# Start Docker
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
```
*Note: Log out and log back in for group changes to take effect.*

## 3. Deploy Code
### Option A: Using Git (Recommended)
```bash
# Clone repository
git clone <your-repo-url> school_erp
cd school_erp

# Checkout the release tag
git checkout V_1.1.0
```

### Option B: Using Tarball (If private repo access is hard)
(See `setup_ec2_docker.md` for tarball steps)

## 4. Configuration
Create the `.env` file in the project root (`school_erp/`):
```bash
nano .env
```
Paste your production environment variables (DATABASE_URL, etc.).

## 5. Build and Start
```bash
# Build and start containers in detached mode
docker-compose up --build -d
```

## 6. SSL Configuration (HTTPS)
We will use Certbot on the host (outside docker) or via webroot to get certificates for `school1.edulekha.in`.

### Recommended: Certbot Nginx on Host (Easiest)
Since we are using Docker, Nginx inside Docker is listening on port 80.
To get a cert easily, we can stop the docker container temporarily, run certbot standalone, then mount the certs.

**Step 1: Get Certificate**
```bash
# Stop docker nginx if running to free port 80
docker-compose stop nginx

# Run Certbot Standalone
sudo certbot certonly --standalone -d school1.edulekha.in
```
*Follow the prompts. Certs will be saved in `/etc/letsencrypt/live/school1.edulekha.in/`.*

**Step 2: Start Application**
```bash
# Start everything back up
docker-compose up -d
```
*Note: You may need to update `nginx.conf` and `docker-compose.yml` to mount/use the generated certificates if you want HTTPS termination at the Nginx container level.*

**Alternative: Nginx Proxy Manager**
For easier management, consider running Nginx Proxy Manager in Docker.
