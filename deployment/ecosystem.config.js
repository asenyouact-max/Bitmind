module.exports = {
  apps: [{
    name: 'bitmind',
    script: './server/server.js',
    cwd: '/opt/Bitmind',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    restart_delay: 3000,
    max_restarts: 10,
    min_uptime: '5s',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      STRATUM_PORT: 3333
      // RPC_* variables must be set in /opt/Bitmind/.env file
      // DO NOT hardcode secrets here - they should come from .env
    },
    error_file: '/opt/Bitmind/logs/bitmind-error.log',
    out_file: '/opt/Bitmind/logs/bitmind-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true,
    kill_timeout: 5000
  }]
};
