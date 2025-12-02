#!/bin/bash
PEM_FILE="../linux_av.pem"
EC2_HOST="ubuntu@ec2-3-111-41-254.ap-south-1.compute.amazonaws.com"

ssh -i "$PEM_FILE" "$EC2_HOST" "sudo docker ps -a"
