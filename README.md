# Bitmind

Bitcoin mining pool with Stratum server, ESP32 device support, and web interface.

## Architecture

```
ESP32 Devices → VPS Backend → Bitcoin Core (via Tailscale VPN)
                      ↓
                 Web Interface
```

**Components:**
- **server/** - Node.js backend with Stratum server and API
- **bridge/** - ESP32 firmware and communication bridge
- **node/** - Bitcoin Core RPC client helpers
- **esp32_firmware/** - ESP32 mining device firmware
- **deployment/** - PM2, Nginx, firewall, and Tailscale configuration
- **scripts/** - Health check and utility scripts

## Security

**Critical:** Bitcoin Core RPC is accessible ONLY via Tailscale VPN. The RPC port (8332) is not exposed to the public internet. Both Windows and VPS firewalls restrict access to the Tailscale network range (100.0.0.0/8).

See `deployment/tailscale-notes.md` for detailed security setup.

## Prerequisites

- Node.js 18+ (for backend)
- Bitcoin Core full node (Windows/Linux)
- Tailscale VPN installed on both VPS and Bitcoin Core machine
- PM2 (for process management)
- Nginx (for reverse proxy, optional)

## Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd bitmind
```

### 2. Configure Environment

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
PORT=3001
STRATUM_PORT=3333
RPC_HOST=100.x.x.x  # Tailscale IP of Bitcoin Core machine
RPC_PORT=8332
RPC_USER=Global
RPC_PASSWORD=your_secure_password
RPC_URL=http://100.x.x.x:8332
COINBASE_ADDRESS=your_bitcoin_address
RPC_TIMEOUT=30000
```

### 3. Install Dependencies

```bash
cd server
npm install
```

### 4. Configure Bitcoin Core

Edit `bitcoin.conf` on your Bitcoin Core machine:

```conf
rpcuser=Global
rpcpassword=your_secure_password
rpcbind=0.0.0.0
rpcport=8332
rpcallowip=100.0.0.0/8
```

Restart Bitcoin Core after configuration.

### 5. Setup Tailscale VPN

Install Tailscale on both VPS and Bitcoin Core machine:

```bash
# On VPS
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# On Windows
# Download and install from https://tailscale.com/download/windows
```

Verify both devices are connected and note the Tailscale IP of the Windows machine.

### 6. Configure Firewall

**VPS (Ubuntu):**
```bash
sudo ufw allow from 100.0.0.0/8 to any port 8332 proto tcp
sudo ufw allow 3001/tcp
sudo ufw allow 3333/tcp
sudo ufw enable
```

**Windows:** Run the firewall rules from `deployment/firewall.rules` (adapted for Windows).

## Running with PM2

### Start Backend

```bash
chmod +x deployment/start.sh
./deployment/start.sh
```

Or manually:

```bash
pm2 start deployment/ecosystem.config.js
pm2 save
```

### Stop Backend

```bash
chmod +x deployment/stop.sh
./deployment/stop.sh
```

Or manually:

```bash
pm2 stop bitmind
```

### View Logs

```bash
pm2 logs bitmind
```

### View Status

```bash
pm2 status
```

## Health Check

Run the health check script to verify system status:

```bash
node scripts/healthcheck.js
```

This checks:
- Backend HTTP server
- Bitcoin Core RPC connectivity
- WebSocket server

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/stats` - Mining statistics
- `GET /api/devices` - Connected devices
- `GET /api/shares` - Share statistics
- `GET /api/monitoring` - System monitoring
- `GET /api/lifecycle` - Lifecycle statistics
- `GET /api/top-miners` - Top miners

## Stratum Server

Miners connect to Stratum server on port 3333:

```
stratum+tcp://your-vps-ip:3333
```

## Nginx Configuration (Optional)

For production deployment with SSL, use the provided Nginx configuration:

```bash
sudo cp deployment/nginx.conf /etc/nginx/sites-available/bitmind
sudo ln -s /etc/nginx/sites-available/bitmind /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Update SSL certificate paths in the configuration.

## Troubleshooting

### RPC Connection Failed

1. Verify Tailscale is running on both devices
2. Check RPC credentials in `.env` and `bitcoin.conf`
3. Verify firewall rules allow Tailscale network
4. Test RPC manually: `curl -u Global:password http://100.x.x.x:8332`

### Backend Won't Start

1. Check `.env` file exists and is configured
2. Verify Bitcoin Core is running
3. Check PM2 logs: `pm2 logs bitmind`
4. Ensure dependencies are installed: `cd server && npm install`

### Miners Can't Connect

1. Verify Stratum port 3333 is open in firewall
2. Check Stratum server is running: `pm2 status`
3. Verify miner configuration uses correct IP and port

## License

MIT

## Support

For issues and questions, please refer to the deployment documentation in the `deployment/` directory.
