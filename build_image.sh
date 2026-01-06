#!/bin/bash
set -e

IMAGE_NAME="sshatru/erp:latest"
OUTPUT_FILE="school_erp_latest.tar"

echo "Building Docker image: $IMAGE_NAME..."
docker build -t "$IMAGE_NAME" .

echo "Saving image to $OUTPUT_FILE..."
docker save -o "$OUTPUT_FILE" "$IMAGE_NAME"

echo "Build complete! Image saved to $OUTPUT_FILE"
