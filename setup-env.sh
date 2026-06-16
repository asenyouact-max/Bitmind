#!/bin/bash

# Bitmind Environment Setup Script
# Creates required .env file for backend

echo "=========================================="
echo "BITMIND ENVIRONMENT SETUP"
echo "=========================================="
echo ""

# Navigate to backend directory
cd /opt/Bitmind

# Check if .env already exists
if [ -f .env ]; then
  echo "⚠️  .env file already exists at /opt/Bitmind/.env"
  echo "Please edit it manually to update values."
  echo ""
  echo "Current contents:"
  cat .env
  echo ""
  exit 0
fi

# Create .env file with placeholder values
cat > .env << 'EOF'
PORT=3001
RPC_HOST=YOUR_RPC_HOST
RPC_PORT=8332
RPC_USER=YOUR_RPC_USER
RPC_PASSWORD=YOUR_RPC_PASSWORD
WS_PATH=/ws
EOF

echo "✅ .env file created at /opt/Bitmind/.env"
echo ""
echo "⚠️  IMPORTANT: You must edit .env and replace placeholder values:"
echo "   - RPC_HOST: Your Bitcoin Core RPC host (Tailscale IP)"
echo "   - RPC_USER: Your Bitcoin Core RPC username"
echo "   - RPC_PASSWORD: Your Bitcoin Core RPC password"
echo ""
echo "Edit the file:"
echo "  nano /opt/Bitmind/.env"
echo ""
echo "=========================================="
echo "NEXT STEPS:"
echo "=========================================="
echo "1. Edit .env with your RPC credentials"
echo "2. Install dependencies: npm install dotenv express ws cors axios"
echo "3. Clean PM2: pm2 delete bitmind"
echo "4. Start backend: pm2 start /opt/Bitmind/server/server.js --name bitmind"
echo "5. Save PM2: pm2 save"
echo "6. Verify: curl http://localhost:3001/health"
echo ""
