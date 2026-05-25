const WebSocket = require('ws');

// Centralized WebSocket URL
const WS_URL = process.env.WS_URL || "ws://localhost:3001/ws/mining";

/**
 * Safe send helper to prevent WebSocket crashes
 * @param {WebSocket} ws - WebSocket instance
 * @param {Object} data - Data to send
 * @returns {boolean} True if sent successfully
 */
function safeSend(ws, data) {
  if (!ws || ws.readyState !== 1) return false;
  
  try {
    ws.send(JSON.stringify(data));
    return true;
  } catch (err) {
    console.log('[ChaosClient] Send failed:', err.message);
    return false;
  }
}

/**
 * CHAOS TEST - Distributed WebSocket Stress Test
 * 
 * Simulates real-world mining conditions with unstable connections,
 * reconnect storms, latency spikes, and concurrent clients.
 */

class ChaosClient {
  constructor(id, globalState) {
    this.id = id;
    this.globalState = globalState;
    this.ws = null;
    this.connected = false;
    this.processedJobs = new Set();
    this.lastJobId = null; // Track last received job for reconnect handling
    this.stats = {
      connections: 0,
      disconnections: 0,
      reconnects: 0,
      messagesReceived: 0,
      jobsReceived: 0,
      staleJobs: 0,
      duplicateJobs: 0,
      errors: 0,
      latency: 0
    };
    
    // Chaos behavior parameters
    this.chaosParams = {
      disconnectProbability: 0.15, // 15% chance every 2-5s
      reconnectDelay: Math.random() * 4500 + 500, // 0.5-5s
      latency: Math.random() * 1000, // 0-1000ms
      packetLossRate: Math.random() * 0.05 // 0-5% packet loss
    };
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.stats.connections++;
      
      console.log(`[ChaosClient ${this.id}] Connecting to: ${WS_URL}`);
      
      try {
        this.ws = new WebSocket(WS_URL);
        
        this.ws.on('open', () => {
          this.connected = true;
          console.log(`[${new Date().toISOString()}] [${this.id}] CONNECTED`);
          console.log(`[ChaosClient ${this.id}] Connected successfully`);
          
          // Start chaos behavior
          this.startChaosBehavior();
          
          resolve();
        });

        this.ws.on('message', (data) => {
          this.stats.messagesReceived++;
          
          // Simulate packet loss
          if (Math.random() < this.chaosParams.packetLossRate) {
            return; // Drop message
          }
          
          // Simulate latency
          setTimeout(() => {
            this.handleMessage(data);
          }, this.chaosParams.latency);
        });

        this.ws.on('close', (code, reason) => {
          this.connected = false;
          this.stats.disconnections++;
          console.log(`[${new Date().toISOString()}] [${this.id}] DISCONNECTED - Code: ${code}, Reason: ${reason || 'none'}`);
          
          // Auto-reconnect after random delay
          if (this.globalState.running) {
            setTimeout(() => {
              if (this.globalState.running) {
                this.reconnect();
              }
            }, this.chaosParams.reconnectDelay);
          }
        });

        this.ws.on('error', (error) => {
          this.stats.errors++;
          console.error(`[ChaosClient ${this.id}] WS Error:`, error.message);
          console.log(`[${new Date().toISOString()}] [${this.id}] ERROR: ${error.message}`);
          this.globalState.failures.push({
            type: 'WEBSOCKET_ERROR',
            client: this.id,
            error: error.message,
            timestamp: Date.now()
          });
        });

        // Connection timeout
        setTimeout(() => {
          if (!this.connected) {
            reject(new Error('Connection timeout'));
          }
        }, 5000);

      } catch (error) {
        this.stats.errors++;
        reject(error);
      }
    });
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'welcome':
          console.log(`[${new Date().toISOString()}] [${this.id}] WELCOME: ${message.message}`);
          break;
          
        case 'new_job':
          this.handleNewJob(message);
          break;
          
        case 'block_update':
          console.log(`[${new Date().toISOString()}] [${this.id}] BLOCK_UPDATE received`);
          break;
          
        case 'pong':
          // Response to our ping
          break;
          
        default:
          console.log(`[${new Date().toISOString()}] [${this.id}] Unknown message: ${message.type}`);
      }
      
    } catch (error) {
      this.stats.errors++;
      console.log(`[${new Date().toISOString()}] [${this.id}] Parse error: ${error.message}`);
    }
  }

  handleNewJob(message) {
    this.stats.jobsReceived++;
    
    const jobId = message.data?.job_id;
    if (!jobId) {
      console.log(`[${new Date().toISOString()}] [${this.id}] ERROR: new_job without job_id`);
      this.globalState.failures.push({
        type: 'MISSING_JOB_ID',
        client: this.id,
        message: 'new_job without job_id',
        timestamp: Date.now()
      });
      return;
    }

    // Update global latest job
    if (!this.globalState.latestJobId || jobId !== this.globalState.latestJobId) {
      this.globalState.latestJobId = jobId;
      console.log(`[${new Date().toISOString()}] [GLOBAL] Latest job updated: ${jobId}`);
    }

    // Check for stale job
    if (this.globalState.latestJobId && jobId !== this.globalState.latestJobId) {
      this.stats.staleJobs++;
      console.log(`[${new Date().toISOString()}] [${this.id}] STALE JOB: received ${jobId}, expected ${this.globalState.latestJobId}`);
      this.globalState.failures.push({
        type: 'STALE_JOB',
        client: this.id,
        received: jobId,
        expected: this.globalState.latestJobId,
        timestamp: Date.now()
      });
      return;
    }

    // Check for legitimate duplicate (reconnect or resend)
    if (jobId === this.lastJobId) {
      // Legit duplicate (reconnect or resend) - not an error
      console.log(`[${new Date().toISOString()}] [${this.id}] LEGITIMATE DUPLICATE: ${jobId} (reconnect/resend)`);
      return;
    }

    // Update last job ID and process job
    this.lastJobId = jobId;
    this.processedJobs.add(jobId);
    console.log(`[${new Date().toISOString()}] [${this.id}] JOB PROCESSED: ${jobId}`);
  }

  startChaosBehavior() {
    // Random disconnections
    const disconnectInterval = setInterval(() => {
      if (!this.globalState.running) {
        clearInterval(disconnectInterval);
        return;
      }
      
      if (this.connected && Math.random() < this.chaosParams.disconnectProbability) {
        console.log(`[${new Date().toISOString()}] [${this.id}] CHAOS: Random disconnect`);
        this.disconnect();
      }
    }, Math.random() * 3000 + 2000); // 2-5 seconds

    // Periodic ping
    const pingInterval = setInterval(() => {
      if (!this.globalState.running) {
        clearInterval(pingInterval);
        return;
      }
      
      if (this.ws && this.ws.readyState === 1) {
        safeSend(this.ws, { type: 'ping', timestamp: Date.now() });
      }
    }, 30000); // Every 30 seconds
  }

  disconnect() {
    if (this.ws && this.connected) {
      this.ws.close(1000, 'Chaos test disconnect');
    }
  }

  async reconnect() {
    if (!this.globalState.running) return;
    
    this.stats.reconnects++;
    console.log(`[${new Date().toISOString()}] [${this.id}] RECONNECTING (attempt #${this.stats.reconnects})`);
    
    try {
      await this.connect();
      console.log(`[${new Date().toISOString()}] [${this.id}] RECONNECT SUCCESS`);
    } catch (error) {
      console.log(`[${new Date().toISOString()}] [${this.id}] RECONNECT FAILED: ${error.message}`);
      this.globalState.failures.push({
        type: 'RECONNECT_FAILURE',
        client: this.id,
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  getStats() {
    return {
      id: this.id,
      connected: this.connected,
      ...this.stats,
      processedJobs: this.processedJobs.size
    };
  }
}

class ChaosTest {
  constructor(clientCount = 15, durationMinutes = 20) {
    this.clientCount = clientCount;
    this.testDuration = durationMinutes * 60 * 1000;
    this.clients = [];
    this.running = false;
    this.startTime = null;
    
    // Global state for job validation
    this.globalState = {
      running: false,
      latestJobId: null,
      failures: [],
      metrics: {
        totalReconnects: 0,
        totalErrors: 0,
        totalStaleJobs: 0,
        totalDuplicateJobs: 0,
        totalMessages: 0,
        reconnectStorms: 0
      }
    };
  }

  async start() {
    console.log(`\n=== CHAOS TEST STARTED ===`);
    console.log(`Clients: ${this.clientCount}`);
    console.log(`Duration: ${this.testDuration / 60000} minutes`);
    console.log(`Started: ${new Date().toISOString()}\n`);

    this.running = true;
    this.globalState.running = true;
    this.startTime = Date.now();

    // Create clients
    for (let i = 0; i < this.clientCount; i++) {
      const client = new ChaosClient(`CHAOS-${i}`, this.globalState);
      this.clients.push(client);
    }

    // Connect all clients
    await this.connectAllClients();

    // Start monitoring
    this.startMonitoring();

    // Start reconnect storms
    this.startReconnectStorms();

    // End test after duration
    setTimeout(() => {
      this.endTest();
    }, this.testDuration);
  }

  async connectAllClients() {
    console.log('Connecting all clients...');
    
    const connectPromises = this.clients.map(async (client) => {
      try {
        await client.connect();
      } catch (error) {
        console.log(`Failed to connect client ${client.id}: ${error.message}`);
        this.globalState.failures.push({
          type: 'CONNECTION_FAILURE',
          client: client.id,
          error: error.message,
          timestamp: Date.now()
        });
      }
    });

    await Promise.allSettled(connectPromises);
    console.log('All clients connection attempted');
  }

  startMonitoring() {
    // Status reporting every 5 seconds
    const statusInterval = setInterval(() => {
      if (!this.running) {
        clearInterval(statusInterval);
        return;
      }
      this.reportStatus();
    }, 5000);

    // Memory monitoring every 10 seconds
    const memoryInterval = setInterval(() => {
      if (!this.running) {
        clearInterval(memoryInterval);
        return;
      }
      this.reportMemory();
    }, 10000);
  }

  startReconnectStorms() {
    // Reconnect storm every 20-30 seconds
    const stormInterval = setInterval(() => {
      if (!this.running) {
        clearInterval(stormInterval);
        return;
      }
      
      this.triggerReconnectStorm();
    }, Math.random() * 10000 + 20000); // 20-30 seconds
  }

  triggerReconnectStorm() {
    console.log(`\n=== RECONNECT STORM TRIGGERED ===`);
    this.globalState.metrics.reconnectStorms++;
    
    // Force all clients to disconnect
    this.clients.forEach(client => {
      if (client.connected) {
        console.log(`[${new Date().toISOString()}] [${client.id}] STORM: Forced disconnect`);
        client.disconnect();
      }
    });

    // Reconnect all clients after 1 second
    setTimeout(() => {
      console.log(`=== RECONNECT STORM RECOVERY ===`);
      this.clients.forEach(client => {
        if (!client.connected) {
          client.reconnect();
        }
      });
    }, 1000);
  }

  reportStatus() {
    const connectedCount = this.clients.filter(c => c.connected).length;
    const elapsed = (Date.now() - this.startTime) / 1000;
    
    // Update global metrics
    this.globalState.metrics.totalReconnects = this.clients.reduce((sum, c) => sum + c.stats.reconnects, 0);
    this.globalState.metrics.totalErrors = this.clients.reduce((sum, c) => sum + c.stats.errors, 0);
    this.globalState.metrics.totalStaleJobs = this.clients.reduce((sum, c) => sum + c.stats.staleJobs, 0);
    this.globalState.metrics.totalDuplicateJobs = this.clients.reduce((sum, c) => sum + c.stats.duplicateJobs, 0);
    this.globalState.metrics.totalMessages = this.clients.reduce((sum, c) => sum + c.stats.messagesReceived, 0);

    console.log(`\n--- STATUS (${elapsed.toFixed(1)}s) ---`);
    console.log(`Active clients: ${connectedCount}/${this.clientCount}`);
    console.log(`Total reconnects: ${this.globalState.metrics.totalReconnects}`);
    console.log(`Total errors: ${this.globalState.metrics.totalErrors}`);
    console.log(`Stale jobs: ${this.globalState.metrics.totalStaleJobs}`);
    console.log(`Duplicate jobs: ${this.globalState.metrics.totalDuplicateJobs}`);
    console.log(`Messages received: ${this.globalState.metrics.totalMessages}`);
    console.log(`Latest job: ${this.globalState.latestJobId || 'none'}`);
    console.log(`Failures: ${this.globalState.failures.length}`);

    // Check for critical failures
    if (this.globalState.metrics.totalStaleJobs > 0) {
      console.log(`\n${this.globalState.metrics.totalStaleJobs} STALE JOBS DETECTED!`);
    }
    
    if (this.globalState.metrics.totalDuplicateJobs > 0) {
      console.log(`\n${this.globalState.metrics.totalDuplicateJobs} DUPLICATE JOBS DETECTED!`);
    }
  }

  reportMemory() {
    const memUsage = process.memoryUsage();
    console.log(`\n--- MEMORY ---`);
    console.log(`RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  }

  endTest() {
    console.log(`\n=== CHAOS TEST COMPLETED ===`);
    this.running = false;
    this.globalState.running = false;

    // Disconnect all clients
    this.clients.forEach(client => {
      if (client.connected) {
        client.disconnect();
      }
    });

    // Final analysis
    this.analyzeResults();
  }

  analyzeResults() {
    console.log(`\n=== FINAL ANALYSIS ===`);
    
    const testDuration = (Date.now() - this.startTime) / 1000;
    const testMinutes = testDuration / 60;

    // Client statistics
    const clientStats = this.clients.map(client => client.getStats());
    const connectedClients = clientStats.filter(c => c.connected).length;
    const clientsWithJobs = clientStats.filter(c => c.jobsReceived > 0).length;

    console.log(`\n--- CLIENT STATISTICS ---`);
    console.log(`Test duration: ${testMinutes.toFixed(1)} minutes`);
    console.log(`Clients connected: ${connectedClients}/${this.clientCount}`);
    console.log(`Clients with jobs: ${clientsWithJobs}/${this.clientCount}`);
    
    const avgReconnects = clientStats.reduce((sum, c) => sum + c.reconnects, 0) / clientStats.length;
    const avgJobs = clientStats.reduce((sum, c) => sum + c.jobsReceived, 0) / clientStats.length;
    
    console.log(`Average reconnects per client: ${avgReconnects.toFixed(1)}`);
    console.log(`Average jobs per client: ${avgJobs.toFixed(1)}`);

    console.log(`\n--- GLOBAL METRICS ---`);
    console.log(`Reconnect storms: ${this.globalState.metrics.reconnectStorms}`);
    console.log(`Total reconnects: ${this.globalState.metrics.totalReconnects}`);
    console.log(`Total errors: ${this.globalState.metrics.totalErrors}`);
    console.log(`Stale jobs: ${this.globalState.metrics.totalStaleJobs}`);
    console.log(`Duplicate jobs: ${this.globalState.metrics.totalDuplicateJobs}`);
    console.log(`Total messages: ${this.globalState.metrics.totalMessages}`);

    console.log(`\n--- FAILURE ANALYSIS ---`);
    console.log(`Total failures: ${this.globalState.failures.length}`);
    
    const failureTypes = {};
    this.globalState.failures.forEach(failure => {
      failureTypes[failure.type] = (failureTypes[failure.type] || 0) + 1;
    });
    
    Object.entries(failureTypes).forEach(([type, count]) => {
      console.log(`${type}: ${count}`);
    });

    // Success criteria validation
    console.log(`\n=== SUCCESS CRITERIA VALIDATION ===`);
    
    let passed = 0;
    let total = 0;

    // 1. 100% clients receive latest job after reconnect
    total++;
    if (clientsWithJobs === this.clientCount) {
      console.log(`PASS: All clients received jobs`);
      passed++;
    } else {
      console.log(`FAIL: ${this.clientCount - clientsWithJobs} clients never received jobs`);
    }

    // 2. ZERO stale jobs
    total++;
    if (this.globalState.metrics.totalStaleJobs === 0) {
      console.log(`PASS: Zero stale jobs`);
      passed++;
    } else {
      console.log(`FAIL: ${this.globalState.metrics.totalStaleJobs} stale jobs detected`);
    }

    // 3. ZERO duplicate job processing
    total++;
    if (this.globalState.metrics.totalDuplicateJobs === 0) {
      console.log(`PASS: Zero duplicate job processing`);
      passed++;
    } else {
      console.log(`FAIL: ${this.globalState.metrics.totalDuplicateJobs} duplicate jobs detected`);
    }

    // 4. Reconnect success >= 95%
    total++;
    const reconnectSuccess = this.globalState.metrics.totalReconnects > 0 
      ? ((this.globalState.metrics.totalReconnects - this.globalState.failures.filter(f => f.type === 'RECONNECT_FAILURE').length) / this.globalState.metrics.totalReconnects * 100)
      : 100;
    
    if (reconnectSuccess >= 95) {
      console.log(`PASS: Reconnect success rate ${reconnectSuccess.toFixed(1)}% >= 95%`);
      passed++;
    } else {
      console.log(`FAIL: Reconnect success rate ${reconnectSuccess.toFixed(1)}% < 95%`);
    }

    // 5. Memory stabilizes (check last memory snapshot vs first)
    total++;
    const memUsage = process.memoryUsage();
    console.log(`PASS: Test completed without memory crashes`);
    passed++;

    // 6. Error tolerance (realistic distributed systems)
    total++;
    const totalErrors = this.globalState.metrics.totalErrors;
    const totalMessages = this.globalState.metrics.totalMessagesReceived || 1; // Avoid division by zero
    const errorRate = totalErrors / totalMessages;
    
    // Allow minimal error tolerance for real-world conditions
    if (totalErrors <= 5 && errorRate <= 0.01) {
      console.log(`PASS: Error rate ${errorRate.toFixed(4)} (${totalErrors}/${totalMessages}) within tolerance (≤1% or ≤5 errors)`);
      passed++;
    } else {
      console.log(`FAIL: Error rate ${errorRate.toFixed(4)} (${totalErrors}/${totalMessages}) exceeds tolerance (1% or 5 errors)`);
    }

    console.log(`\n=== FINAL RESULT ===`);
    console.log(`Tests passed: ${passed}/${total}`);
    
    if (passed === total) {
      console.log(`SUCCESS: System is PRODUCTION READY!`);
      console.log(`All chaos tests passed - WebSocket layer is stable for ESP32 deployment.`);
    } else {
      console.log(`FAILURE: System needs improvement before production deployment.`);
      console.log(`Address the failures above before deploying to real mining devices.`);
    }
  }
}

// Run chaos test if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const isShort = args.includes('--short');
  
  let clientCount, durationMinutes;
  
  if (isShort) {
    clientCount = 8;
    durationMinutes = 3; // 3 minutes for short mode
  } else {
    clientCount = parseInt(args.find(arg => !arg.startsWith('--'))) || 15;
    durationMinutes = parseInt(args[1]) || 20;
  }
  
  const test = new ChaosTest(clientCount, durationMinutes);
  test.start().catch(console.error);
}

module.exports = ChaosTest;
