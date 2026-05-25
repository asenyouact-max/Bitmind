# Tailscale VPN Setup for Bitmind

## Overview

Bitmind uses Tailscale VPN to securely connect the VPS backend to the Windows Bitcoin Core node. This ensures RPC communication is encrypted and private.

## Architecture

```
VPS (Ubuntu) <-- Tailscale VPN --> Windows (Bitcoin Core)
    |                                   |
    |                                   |
Backend API                     Bitcoin Core RPC
Port 3001                       Port 8332
```

## Setup Instructions

### 1. Install Tailscale on VPS

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

### 2. Install Tailscale on Windows

Download and install from: https://tailscale.com/download/windows

### 3. Connect Both Devices

- Log in to Tailscale on both devices using the same account
- Verify both devices appear in the Tailscale admin panel
- Note the Tailscale IP of the Windows machine (format: 100.x.x.x)

### 4. Configure Bitcoin Core RPC

Edit `bitcoin.conf` on Windows:

```conf
rpcuser=Global
rpcpassword=YOUR_SECURE_PASSWORD
rpcbind=0.0.0.0
rpcport=8332
rpcallowip=100.0.0.0/8
```

### 5. Configure VPS Backend

Edit `.env` on VPS:

```env
RPC_HOST=100.x.x.x  # Tailscale IP of Windows machine
RPC_PORT=8332
RPC_USER=Global
RPC_PASSWORD=YOUR_SECURE_PASSWORD
```

### 6. Windows Firewall Configuration

Run the provided PowerShell script as Administrator:

```powershell
.\WINDOWS_FIREWALL_SETUP.ps1
```

This allows RPC port 8332 only from Tailscale network (100.0.0.0/8).

### 7. VPS Firewall Configuration

Apply the provided firewall rules:

```bash
sudo ufw allow from 100.0.0.0/8 to any port 8332 proto tcp
```

## Verification

### Test RPC from VPS

```bash
curl -u Global:YOUR_PASSWORD http://100.x.x.x:8332 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"1.0","id":"test","method":"getblockchaininfo","params":[]}'
```

Expected response: JSON with blockchain info

### Test from Backend

Run the health check script:

```bash
node scripts/healthcheck.js
```

## Security Notes

- **Tailscale provides encryption**: All RPC traffic is encrypted
- **Network isolation**: RPC is only accessible via Tailscale VPN
- **Firewall rules**: Both Windows and VPS firewalls restrict to Tailscale IPs
- **No public exposure**: RPC port is not exposed to the public internet

## Troubleshooting

### RPC Connection Refused

1. Verify Tailscale is running on both devices
2. Check Windows firewall rules
3. Verify Bitcoin Core is running
4. Check RPC credentials in both configs

### Tailscale IP Changes

Tailscale IPs are generally stable but can change. If RPC fails:

1. Check current Tailscale IP on Windows: `tailscale ip -4`
2. Update RPC_HOST in VPS .env
3. Restart backend: `pm2 restart bitmind`

### Firewall Issues

Windows:
```powershell
Get-NetFirewallRule -DisplayName "*Bitcoin*"
```

VPS:
```bash
sudo ufw status verbose
```

## Best Practices

1. **Use strong RPC passwords**: Avoid special characters that may cause parsing issues
2. **Keep Tailscale updated**: Regular updates ensure security patches
3. **Monitor logs**: Check Bitcoin Core debug.log for unauthorized access attempts
4. **ACL configuration**: Consider Tailscale ACLs for additional access control
5. **Regular testing**: Periodically test RPC connectivity

## Network Ranges

Tailscale uses the 100.0.0.0/8 range for private IPs. This is reserved and not routable on the public internet, providing an additional layer of security.
