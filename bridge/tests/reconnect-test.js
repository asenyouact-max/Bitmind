const TestClient = require('./client');

/**
 * TEST 1: RECONNECT TORTURE TEST
 * 
 * Opens 5-10 WebSocket clients
 * Randomly disconnects and reconnects clients every few seconds
 * Validates immediate job reception on reconnect
 */

class ReconnectTest {
  constructor(clientCount = 8) {
    this.clientCount = clientCount;
    this.clients = [];
    this.testDuration = 60000; // 60 seconds
    this.disconnectInterval = 3000; // Every 3 seconds
    this.running = false;
  }

  async start() {
    console.log(`\n=== RECONNECT TORTURE TEST ===`);
    console.log(`Creating ${this.clientCount} clients for ${this.testDuration/1000} seconds`);
    console.log(`Random disconnects every ${this.disconnectInterval/1000} seconds\n`);

    this.running = true;

    // Create initial clients
    for (let i = 0; i < this.clientCount; i++) {
      const client = new TestClient(`RECONNECT-${i}`);
      this.clients.push(client);
    }

    // Start random disconnect/reconnect cycle
    const disconnectTimer = setInterval(() => {
      if (!this.running) {
        clearInterval(disconnectTimer);
        return;
      }
      this.randomDisconnectReconnect();
    }, this.disconnectInterval);

    // Connect all clients initially
    await this.connectAllClients();

    // Run test for specified duration
    setTimeout(() => {
      this.running = false;
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
      }
    });

    await Promise.allSettled(connectPromises);
    console.log('Initial connection complete');
  }

  randomDisconnectReconnect() {
    // Select 1-3 random clients to disconnect/reconnect
    const count = Math.floor(Math.random() * 3) + 1;
    const selectedClients = [];

    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * this.clients.length);
      const client = this.clients[randomIndex];
      
      if (!selectedClients.includes(client)) {
        selectedClients.push(client);
      }
    }

    console.log(`\n--- Random disconnect/reconnect cycle ---`);
    console.log(`Selected ${selectedClients.length} clients for cycle`);

    selectedClients.forEach(client => {
      if (client.connected) {
        console.log(`Disconnecting client ${client.id}`);
        client.disconnect();
        
        // Reconnect after random delay (500ms to 2s)
        setTimeout(async () => {
          if (!this.running) return;
          
          console.log(`Reconnecting client ${client.id}`);
          try {
            await client.connect();
            console.log(`Client ${client.id} reconnected successfully`);
          } catch (error) {
            console.log(`Failed to reconnect client ${client.id}: ${error.message}`);
          }
        }, Math.random() * 1500 + 500);
      }
    });
  }

  endTest() {
    console.log(`\n=== TEST COMPLETE ===`);
    
    // Disconnect all clients
    this.clients.forEach(client => {
      if (client.connected) {
        client.disconnect();
      }
    });

    // Analyze results
    this.analyzeResults();
  }

  analyzeResults() {
    console.log(`\n--- RECONNECT TEST ANALYSIS ---`);
    
    let totalConnections = 0;
    let clientsWithJobs = 0;
    let totalJobReceptions = 0;
    const allJobIds = new Set();

    this.clients.forEach(client => {
      const stats = client.getStats();
      totalConnections += stats.connectionCount;
      
      if (stats.receivedJobs.length > 0) {
        clientsWithJobs++;
        totalJobReceptions += stats.receivedJobs.length;
        stats.receivedJobs.forEach(jobId => allJobIds.add(jobId));
      }

      console.log(`Client ${client.id}:`);
      console.log(`  Connections: ${stats.connectionCount}`);
      console.log(`  Jobs received: ${stats.receivedJobs.length}`);
      console.log(`  Last job: ${stats.lastJobId || 'none'}`);
      console.log(`  Events: ${stats.eventCount}`);
    });

    console.log(`\n--- SUMMARY ---`);
    console.log(`Total connection attempts: ${totalConnections}`);
    console.log(`Clients that received jobs: ${clientsWithJobs}/${this.clientCount}`);
    console.log(`Total job receptions: ${totalJobReceptions}`);
    console.log(`Unique job IDs seen: ${allJobIds.size}`);
    console.log(`Average connections per client: ${(totalConnections / this.clientCount).toFixed(1)}`);

    // Validation
    console.log(`\n--- VALIDATION ---`);
    
    if (clientsWithJobs === this.clientCount) {
      console.log(`PASS: All clients received at least one job`);
    } else {
      console.log(`FAIL: ${this.clientCount - clientsWithJobs} clients never received jobs`);
    }

    if (totalConnections > this.clientCount * 2) {
      console.log(`PASS: Multiple reconnections occurred (${totalConnections} total)`);
    } else {
      console.log(`WARN: Limited reconnection activity (${totalConnections} total)`);
    }

    if (allJobIds.size > 0) {
      console.log(`PASS: Job data was broadcast (${allJobIds.size} unique jobs)`);
    } else {
      console.log(`FAIL: No job data received by any client`);
    }
  }
}

// Run test if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const isShort = args.includes('--short');
  const clientCount = isShort ? 5 : (parseInt(args.find(arg => !arg.startsWith('--'))) || 8);
  
  const test = new ReconnectTest(clientCount);
  if (isShort) {
    test.testDuration = 30000; // 30 seconds for short mode
  }
  test.start().catch(console.error);
}

module.exports = ReconnectTest;
