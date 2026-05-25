module.exports = {
  apps: [{
    name: 'bitmind',
    script: './server/server.js',
    cwd: './',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 3001,
      STRATUM_PORT: process.env.STRATUM_PORT || 3333,
      RPC_HOST: process.env.RPC_HOST,
      RPC_PORT: process.env.RPC_PORT || 8332,
      RPC_USER: process.env.RPC_USER || 'Global',
      RPC_PASSWORD: process.env.RPC_PASSWORD,
      RPC_URL: process.env.RPC_URL,
      COINBASE_ADDRESS: process.env.COINBASE_ADDRESS,
      RPC_TIMEOUT: process.env.RPC_TIMEOUT || 30000
    },
    error_file: './logs/bitmind-error.log',
    out_file: './logs/bitmind-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true,
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};
