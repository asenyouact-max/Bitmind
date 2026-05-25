const TestClient = require('./client');

// Centralized WebSocket URL
const WS_URL = process.env.WS_URL || "ws://localhost:3001/ws/mining";

/**
 * TEST 5: NETWORK SIMULATION CLIENT
 * 
 * Configurable WebSocket endpoint for remote testing
 * Supports latency simulation and network conditions
 * Handles remote connections with proper error handling
 */

class NetworkClient {
  constructor(options = {}) {
    this.endpoint = options.endpoint || WS_URL;
    this.clientId = options.clientId || 'NETWORK-CLIENT';
    this.latency = options.latency || 0; // Simulated latency in ms
    this.timeout = options.timeout || 10000; // Connection timeout
    this.reconnectDelay = options.reconnectDelay || 3000;
    this.autoReconnect = options.autoReconnect !== false;
    
    this.client = null;
    this.connected = false;
    this.stats = {
      connectionAttempts: 0,
      successfulConnections: 0,
      failedConnections: 0,
      reconnections: 0,
      messagesReceived: 0,
      messagesSent: 0,
      errors: 0,
      totalLatency: 0,
      avgLatency: 0
    };
  }

  async connect() {
    console.log(`\n=== NETWORK CLIENT CONNECTION ===`);
    console.log(`Endpoint: ${this.endpoint}`);
    console.log(`Client ID: ${this.clientId}`);
    console.log(`Simulated latency: ${this.latency}ms`);
    console.log(`Auto reconnect: ${this.autoReconnect}\n`);

    return new Promise((resolve, reject) => {
      this.stats.connectionAttempts++;
      
      // Create client with custom endpoint
      this.client = new TestClient(this.clientId, this.endpoint);
      
      // Add latency simulation
      if (this.latency > 0) {
        this.addLatencySimulation();
      }

      // Enhanced connection handling
      this.client.connect().then(() => {
        this.connected = true;
        this.stats.successfulConnections++;
        console.log(`Network client connected to ${this.endpoint}`);
        
        // Start connection monitoring
        this.startConnectionMonitoring();
        
        resolve();
      }).catch(error => {
        this.stats.failedConnections++;
        this.stats.errors++;
        console.log(`Network client connection failed: ${error.message}`);
        
        if (this.autoReconnect) {
          console.log(`Scheduling reconnect in ${this.reconnectDelay}ms...`);
          setTimeout(() => this.connect(), this.reconnectDelay);
        }
        
        reject(error);
      });

      // Connection timeout
      setTimeout(() => {
        if (!this.connected) {
          this.stats.failedConnections++;
          this.stats.errors++;
          reject(new Error(`Connection timeout after ${this.timeout}ms`));
        }
      }, this.timeout);
    });
  }

  addLatencySimulation() {
    // Override message handling to add latency
    const originalHandleMessage = this.client.handleMessage.bind(this.client);
    const startTime = Date.now();
    
    this.client.handleMessage = (message) => {
      const receiveTime = Date.now();
      const latency = receiveTime - startTime;
      
      this.stats.totalLatency += latency;
      this.stats.avgLatency = this.stats.totalLatency / this.stats.messagesReceived;
      
      // Simulated processing delay
      setTimeout(() => {
        originalHandleMessage(message);
      }, this.latency);
    };

    // Override send to add latency
    const originalSendToClient = this.client.sendToClient.bind(this.client);
    this.client.sendToClient = (ws, data) => {
      setTimeout(() => {
        const result = originalSendToClient(ws, data);
        if (result) {
          this.stats.messagesSent++;
        }
        return result;
      }, this.latency);
    };
  }

  startConnectionMonitoring() {
    // Monitor connection health
    const monitorInterval = setInterval(() => {
      if (!this.connected) {
        clearInterval(monitorInterval);
        return;
      }

      // Send periodic ping to measure latency
      this.ping().then(latency => {
        console.log(`Ping latency: ${latency}ms`);
      }).catch(error => {
        console.log(`Ping failed: ${error.message}`);
      });
    }, 30000); // Every 30 seconds
  }

  async ping() {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.client || !this.client.connected) {
        reject(new Error('Client not connected'));
        return;
      }

      const startTime = Date.now();
      
      // Listen for pong response
      const originalHandleMessage = this.client.handleMessage.bind(this.client);
      this.client.handleMessage = (message) => {
        if (message.type === 'pong') {
          const latency = Date.now() - startTime;
          resolve(latency);
        } else {
          originalHandleMessage(message);
        }
      };

      // Send ping
      this.client.ping();
      
      // Timeout
      setTimeout(() => {
        reject(new Error('Ping timeout'));
      }, 5000);
    });
  }

  disconnect() {
    if (this.client && this.connected) {
      this.connected = false;
      this.client.disconnect();
      console.log(`Network client disconnected`);
    }
  }

  getStats() {
    return {
      ...this.stats,
      endpoint: this.endpoint,
      clientId: this.clientId,
      connected: this.connected,
      successRate: this.stats.connectionAttempts > 0 
        ? (this.stats.successfulConnections / this.stats.connectionAttempts * 100).toFixed(1)
        : 0
    };
  }

  // Static method to create multiple network clients
  static createMultiple(count, options = {}) {
    const clients = [];
    
    for (let i = 0; i < count; i++) {
      const clientOptions = {
        ...options,
        clientId: options.clientId ? `${options.clientId}-${i}` : `NETWORK-${i}`
      };
      
      clients.push(new NetworkClient(clientOptions));
    }
    
    return clients;
  }

  // Static method to test different network conditions
  static async testNetworkConditions() {
    console.log(`\n=== NETWORK CONDITIONS TEST ===`);
    
    const testCases = [
      { name: 'Localhost', endpoint: WS_URL, latency: 0 },
      { name: 'High Latency', endpoint: WS_URL, latency: 500 },
      { name: 'Very High Latency', endpoint: WS_URL, latency: 1000 }
    ];

    for (const testCase of testCases) {
      console.log(`\nTesting: ${testCase.name}`);
      console.log(`Endpoint: ${testCase.endpoint}`);
      console.log(`Latency: ${testCase.latency}ms`);
      
      try {
        const client = new NetworkClient({
          endpoint: testCase.endpoint,
          clientId: `TEST-${testCase.name}`,
          latency: testCase.latency,
          autoReconnect: false
        });
        
        await client.connect();
        
        // Wait for some data
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const stats = client.getStats();
        console.log(`Results:`, stats);
        
        client.disconnect();
        
      } catch (error) {
        console.log(`Failed: ${error.message}`);
      }
    }
  }
}

// Run network conditions test if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'test-conditions') {
    NetworkClient.testNetworkConditions();
  } else {
    const endpoint = args[0] || WS_URL;
    const clientId = args[1] || 'NETWORK-CLIENT';
    const latency = parseInt(args[2]) || 0;
    
    const client = new NetworkClient({
      endpoint,
      clientId,
      latency,
      autoReconnect: true
    });
    
    client.connect().catch(console.error);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\nShutting down network client...');
      client.disconnect();
      process.exit(0);
    });
  }
}

module.exports = NetworkClient;
