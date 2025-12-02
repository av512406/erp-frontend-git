# School ERP Deployment Bundle

This package contains everything needed to deploy the School ERP system to your EC2 instance.

## Contents
- `school_erp_latest.tar`: The Docker image containing the application code.
- `docker-compose.yml`: Docker configuration file.
- `nginx.conf` & `nginx.conf.ssl`: Web server configuration files.
- `linux_av.pem`: SSH key for accessing the EC2 instance.
- `deploy_image.sh`: Script to deploy the application.
- `setup_ssl.sh`: Script to generate SSL certificates.
- `force_ssl.sh`: Script to fix SSL configuration if needed.

## How to Deploy

1.  **Unzip this package** on your local machine (Linux/Mac preferred for scripts).
2.  **Open a terminal** and navigate to the unzipped folder.
3.  **Run the deployment script:**
    ```bash
    ./deploy_image.sh
    ```
    This will upload the image and restart the application on the server.

## SSL Setup (If needed)

If you need to set up or fix SSL:
- Run `./setup_ssl.sh` to generate new certificates.
- Run `./force_ssl.sh` if HTTPS is not working after setup.

## Note
The `linux_av.pem` file is included for convenience. Keep this folder secure.
