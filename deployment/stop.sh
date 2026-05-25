#!/bin/bash

# Bitmind Production Stop Script
# Stops the Bitmind backend using PM2

set -e

echo "Stopping Bitmind backend..."

# Stop PM2 process
pm2 stop bitmind

# Optional: Delete from PM2 list (uncomment if needed)
# pm2 delete bitmind

echo "Bitmind backend stopped successfully!"
echo "View status: pm2 status"
