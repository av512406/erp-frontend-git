# How to Update the Application

To update the application with the latest code from the `DOCKER` branch:

1.  **SSH into your server**:
    ```bash
    ssh -i "path/to/linux_av.pem" ubuntu@ec2-3-111-41-254.ap-south-1.compute.amazonaws.com
    ```

2.  **Navigate to the project directory**:
    ```bash
    cd erp-frontend-git
    ```

3.  **Pull the latest code**:
    ```bash
    git pull origin DOCKER
    ```

4.  **Run the update script**:
    ```bash
    ./setup_ec2.sh
    ```

This script will:
- Pull the latest Docker images (or build them).
- Restart the application containers.
