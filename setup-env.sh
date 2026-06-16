#!/bin/bash

# Bitmind Environment Setup Script
# Creates required .env file for backend

echo "=========================================="
echo "BITMIND ENVIRONMENT SETUP"
echo "=========================================="
echo ""

# Navigate to backend directory
cd /opt/Bitmind

# Create .env file
cat > .env << 'EOF'
PORT=3001
RPC_HOST=100.82.184.116
RPC_PORT=8332
RPC_USER=Global
RPC_PASSWORD=BITMIND400K@Hot$$$
WS_PATH=/ws
EOF

echo "✅ .env file created at /opt/Bitmind/.env"
echo ""
echo "Contents:"
cat .env
echo ""
echo "=========================================="
echo "NEXT STEPS:"
echo "=========================================="
echo "1. Install dependencies: npm install dotenv express ws cors axios"
echo "2. Clean PM2: pm2 delete bitmind"
echo "3. Start backend: pm2 start /opt/Bitmind/server/server.js --name bitmind"
echo "4. Save PM2: pm2 save"
echo "5. Verify: curl http://localhost:3001/health"
echo ""
