#!/bin/bash

# Reset Database Script
# Usage: ./reset_db.sh
# WARNING: THIS WILL DELETE ALL DATA!

echo "⚠️  WARNING: This will DELETE ALL DATA in the database!"
read -p "Are you sure you want to proceed? (y/N): " confirm

if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "❌ Operation cancelled."
    exit 1
fi

echo "🛑 Stopping containers..."
docker-compose down

echo "🗑️  Removing database volume..."
docker volume rm school_erp_postgres_data

echo "🚀 Starting fresh..."
./setup_ec2.sh

echo "✅ Database reset complete. A new empty database has been created."
