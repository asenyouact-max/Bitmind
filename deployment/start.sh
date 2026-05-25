#!/bin/bash

# Bitmind Production Start Script
# Starts the Bitmind backend using PM2

set -e

echo "Starting Bitmind backend..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please create .env from .env.example"
    exit 1
fi

# Check if node_modules exists
if [ ! -d server/node_modules ]; then
    echo "Installing dependencies..."
    cd server
    npm install
    cd ..
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Start with PM2
pm2 start deployment/ecosystem.config.js

# Save PM2 configuration
pm2 save

echo "Bitmind backend started successfully!"
echo "View logs: pm2 logs bitmind"
echo "View status: pm2 status"
