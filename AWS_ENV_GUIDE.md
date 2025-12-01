# Setting Environment Variables on AWS (EC2)

To securely set the Super Admin credentials on your AWS EC2 instance without pushing them to GitHub, follow these steps:

## 1. SSH into your EC2 Instance
Connect to your server via SSH:
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

## 2. Edit the `.env` file
Navigate to your project directory and open the `.env` file:
```bash
cd erp-frontend-git
nano .env
```

## 3. Add the Credentials
Add the following lines to the file. Replace the values with your desired secure credentials:
```env
SUPER_ADMIN_EMAIL=av512406@school.com
SUPER_ADMIN_PASSWORD=Anand@8520#
```
> **Note**: Ensure `SESSION_SECURE=true` is set for production (HTTPS).

## 4. Save and Exit
- Press `Ctrl + O` then `Enter` to save.
- Press `Ctrl + X` to exit.

## 5. Restart the Application
Apply the changes by restarting the Docker containers:
```bash
docker compose down
docker compose up -d
```

## 6. Verify
Check the logs to ensure the application started correctly:
```bash
docker logs school_erp_app
```

### AWS S3 Backup Credentials
To enable automatic S3 backups, add these variables to your `.env` file or Docker environment:

```bash
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=your_region (e.g., ap-south-1)
S3_BUCKET_NAME=your_bucket_name
```

**Note:** Ensure the IAM user has `AmazonS3FullAccess` or permission to `PutObject` in the specified bucket.

### Option 2: Using IAM Roles (Recommended)
Instead of hardcoding keys, you can attach an IAM Role to your EC2 instance.

1.  **Create an IAM Role**:
    -   Go to IAM Console > Roles > Create role.
    -   Select **AWS Service** > **EC2**.
    -   Attach a policy with S3 access (see JSON below).
    -   Name it (e.g., `SchoolERPS3BackupRole`).

2.  **Attach to EC2**:
    -   Go to EC2 Console > Instances > Select your instance.
    -   Actions > Security > Modify IAM role.
    -   Select the role you created and save.

3.  **Update Configuration**:
    -   Leave `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` empty in your `.env` file.
    -   Ensure `S3_BUCKET_NAME` and `AWS_REGION` are set.

#### IAM Policy JSON
Create a new policy with this JSON (replace `your-bucket-name`):
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket-name",
                "arn:aws:s3:::your-bucket-name/*"
            ]
        }
    ]
}
```
