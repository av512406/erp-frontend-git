# Production Deployment Checklist

## 1. Environment Configuration
- [ ] **Create `.env` file**: Copy `.env.example` to `.env`.
  ```bash
  cp .env.example .env
  ```
- [ ] **Update `.env` values**:
  - Set `POSTGRES_PASSWORD` to a strong password.
  - Set `SESSION_SECRET` to a long, random string.
  - Set `SESSION_SECURE=true` (if using HTTPS).
  - Set `DOMAIN_NAME` to your actual domain (e.g., `school.example.com`).

## 2. SSL Configuration (HTTPS)
- [ ] **Obtain SSL Certificates**: Use Certbot to get free certificates from Let's Encrypt.
  ```bash
  # Example command (run on host machine or via a certbot container)
  certbot certonly --standalone -d your-domain.com
  ```
- [ ] **Update `nginx.conf`**:
  - Open `nginx.conf`.
  - Replace `localhost` with your domain name.
  - Uncomment the HTTPS `server` block (lines 26-41).
  - Uncomment the HTTP-to-HTTPS redirect (line 13).
  - Ensure the paths to `ssl_certificate` and `ssl_certificate_key` match where you mounted them in `docker-compose.yml`.

## 3. Database
- [ ] **Persistence**: Ensure the `postgres_data` volume is created.
  ```bash
  docker volume create school_erp_postgres_data
  ```
- [ ] **Backups**: Plan a backup strategy for your database.

## 4. Deployment
- [ ] **Build and Run**:
  ```bash
  docker compose up -d --build
  ```
- [ ] **Verify**: Check logs to ensure everything started correctly.
  ```bash
  docker compose logs -f
  ```

## 5. Security Checks
- [ ] **Firewall**: Ensure only ports 80 and 443 are open to the public. Port 5000 and 5432 should NOT be exposed publicly (Docker handles internal networking).
- [ ] **Secrets**: Never commit your `.env` file to version control.
