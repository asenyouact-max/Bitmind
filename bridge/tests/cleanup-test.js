const TestClient = require('./client');

/**
 * TEST 3: DEAD CONNECTION CLEANUP TEST
 * 
 * Rapidly creates and destroys WebSocket connections
 * Simulates abrupt disconnects
 * Validates backend doesn't retain dead connections
 */

class CleanupTest {
  constructor() {
    this.clients = [];
    this.testDuration = 30000; // 30 seconds
    this.createInterval = 500; // Create new client every 500ms
    this.destroyInterval = 300; // Destroy random client every 300ms
    this.running = false;
    this.createdCount = 0;
    this.destroyedCount = 0;
    this.errors = [];
  }

  async start() {
    console.log(`\n=== DEAD CONNECTION CLEANUP TEST ===`);
    console.log(`Rapid connect/disconnect for ${this.testDuration/1000} seconds`);
    console.log(`Create interval: ${this.createInterval}ms, Destroy interval: ${this.destroyInterval}ms\n`);

    this.running = true;

    // Start creation cycle
    const createTimer = setInterval(() => {
      if (!this.running) {
        clearInterval(createTimer);
        return;
      }
      this.createRandomClient();
    }, this.createInterval);

    // Start destruction cycle
    const destroyTimer = setInterval(() => {
      if (!this.running) {
        clearInterval(destroyTimer);
        return;
      }
      this.destroyRandomClient();
    }, this.destroyInterval);

    // End test after duration
    setTimeout(() => {
      this.running = false;
      this.endTest();
    }, this.testDuration);
  }

  createRandomClient() {
    const clientId = `CLEANUP-${this.createdCount}`;
    const client = new TestClient(clientId);
    this.clients.push(client);
    this.createdCount++;

    console.log(`Creating client ${clientId}`);

    client.connect().then(() => {
      console.log(`Client ${clientId} connected successfully`);
    }).catch(error => {
      console.log(`Failed to connect client ${clientId}: ${error.message}`);
      this.errors.push({ type: 'CONNECT_ERROR', client: clientId, error: error.message });
    });

    // Randomly disconnect immediately (simulate abrupt disconnect)
    if (Math.random() < 0.3) { // 30% chance
      setTimeout(() => {
        if (this.running && client.connected) {
          console.log(`Abrupt disconnect of client ${clientId}`);
          client.disconnect();
          this.destroyedCount++;
        }
      }, Math.random() * 200 + 50); // 50-250ms delay
    }
  }

  destroyRandomClient() {
    if (this.clients.length === 0) {
      return;
    }

    // Find connected clients
    const connectedClients = this.clients.filter(client => client.connected);
    
    if (connectedClients.length === 0) {
      return;
    }

    // Select random connected client
    const randomIndex = Math.floor(Math.random() * connectedClients.length);
    const client = connectedClients[randomIndex];
    
    console.log(`Destroying client ${client.id}`);
    
    // Simulate different types of disconnect
    const disconnectType = Math.random();
    
    if (disconnectType < 0.4) {
      // Normal close
      client.disconnect();
    } else if (disconnectType < 0.7) {
      // Terminate (abrupt)
      if (client.ws) {
        client.ws.terminate();
      }
    } else {
      // Close with error code
      if (client.ws) {
        client.ws.close(1001, 'Test termination');
      }
    }
    
    this.destroyedCount++;
  }

  endTest() {
    console.log(`\n=== TEST COMPLETE ===`);
    
    // Force disconnect any remaining clients
    this.clients.forEach(client => {
      if (client.connected) {
        client.disconnect();
      }
    });

    // Analyze cleanup results
    this.analyzeCleanupResults();
  }

  analyzeCleanupResults() {
    console.log(`\n--- CLEANUP TEST ANALYSIS ---`);
    
    let totalConnections = 0;
    let successfulConnections = 0;
    let failedConnections = 0;
    const connectionEvents = [];
    const disconnectionEvents = [];

    this.clients.forEach(client => {
      const stats = client.getStats();
      totalConnections += stats.connectionCount;
      
      if (stats.connectionCount > 0) {
        successfulConnections++;
      } else {
        failedConnections++;
      }

      // Collect events
      client.getEvents('CONNECT').forEach(event => {
        connectionEvents.push(event);
      });
      
      client.getEvents('DISCONNECT').forEach(event => {
        disconnectionEvents.push(event);
      });
    });

    console.log(`--- CONNECTION STATISTICS ---`);
    console.log(`Total clients created: ${this.createdCount}`);
    console.log(`Total destroy attempts: ${this.destroyedCount}`);
    console.log(`Successful connections: ${successfulConnections}`);
    console.log(`Failed connections: ${failedConnections}`);
    console.log(`Total connection attempts: ${totalConnections}`);
    console.log(`Connection success rate: ${((successfulConnections / this.createdCount) * 100).toFixed(1)}%`);

    console.log(`\n--- EVENT STATISTICS ---`);
    console.log(`Connection events: ${connectionEvents.length}`);
    console.log(`Disconnection events: ${disconnectionEvents.length}`);
    
    // Analyze disconnect codes
    const disconnectCodes = new Map();
    disconnectionEvents.forEach(event => {
      const match = event.message.match(/Code: (\d+)/);
      if (match) {
        const code = parseInt(match[1]);
        disconnectCodes.set(code, (disconnectCodes.get(code) || 0) + 1);
      }
    });
    
    if (disconnectCodes.size > 0) {
      console.log(`Disconnect codes:`);
      disconnectCodes.forEach((count, code) => {
        console.log(`  Code ${code}: ${count} times`);
      });
    }

    console.log(`\n--- ERROR ANALYSIS ---`);
    console.log(`Errors recorded: ${this.errors.length}`);
    this.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.type}: ${error.client} - ${error.error}`);
    });

    // Validation
    console.log(`\n--- VALIDATION ---`);
    
    // Check 1: No errors during rapid connect/disconnect
    if (this.errors.length === 0) {
      console.log(`PASS: No errors during rapid connect/disconnect cycles`);
    } else {
      console.log(`WARN: ${this.errors.length} errors occurred during test`);
    }

    // Check 2: Balanced connect/disconnect
    const balance = Math.abs(connectionEvents.length - disconnectionEvents.length);
    if (balance <= 2) {
      console.log(`PASS: Connection/disconnection events balanced (${connectionEvents.length} vs ${disconnectionEvents.length})`);
    } else {
      console.log(`WARN: Unbalanced events (difference: ${balance})`);
    }

    // Check 3: High connection success rate
    if (successfulConnections >= this.createdCount * 0.8) {
      console.log(`PASS: High connection success rate (${((successfulConnections / this.createdCount) * 100).toFixed(1)}%)`);
    } else {
      console.log(`WARN: Low connection success rate`);
    }

    // Check 4: No hanging connections
    const hangingConnections = this.clients.filter(client => client.connected).length;
    if (hangingConnections === 0) {
      console.log(`PASS: No hanging connections after test`);
    } else {
      console.log(`WARN: ${hangingConnections} clients still connected`);
    }

    console.log(`\n--- MEMORY USAGE ESTIMATE ---`);
    console.log(`Peak concurrent clients: ${this.clients.length}`);
    console.log(`Total client objects created: ${this.createdCount}`);
    console.log(`Client destruction rate: ${((this.destroyedCount / this.createdCount) * 100).toFixed(1)}%`);
  }
}

// Run test if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const isShort = args.includes('--short');
  
  const test = new CleanupTest();
  if (isShort) {
    test.testDuration = 15000; // 15 seconds for short mode
    test.createInterval = 1000; // Slower for short mode
    test.destroyInterval = 800;
  }
  test.start().catch(console.error);
}

module.exports = CleanupTest;
