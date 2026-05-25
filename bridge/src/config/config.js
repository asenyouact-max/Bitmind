require('dotenv').config();

const config = {
  // Server Configuration
  port: process.env.PORT || 3000,
  
  // Bitcoin Core RPC Configuration
  rpc: {
    user: process.env.RPC_USER || 'bitcoin',
    password: process.env.RPC_PASSWORD || '123456',
    host: process.env.RPC_HOST || '127.0.0.1',
    port: process.env.RPC_PORT || 8332,
    url: `http://${process.env.RPC_HOST || '127.0.0.1'}:${process.env.RPC_PORT || 8332}`
  }
};

module.exports = config;
