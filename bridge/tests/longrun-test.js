const TestClient = require('./client');

/**
 * TEST 4: LONG-RUN STABILITY TEST
 * 
 * Maintains 5-10 active clients for extended time
 * Logs reconnect attempts, job updates, errors
 * Validates no crashes, memory leaks, or connection issues
 */

class LongRunTest {
  constructor(clientCount = 6, durationMinutes = 10) {
    this.clientCount = clientCount;
    this.testDuration = durationMinutes * 60 * 1000; // Convert to milliseconds
    this.clients = [];
    this.running = false;
    this.startTime = null;
    this.stats = {
      reconnectAttempts: 0,
      successfulReconnects: 0,
      failedReconnects: 0,
      jobUpdates: 0,
      errors: 0,
      disconnections: 0,
      memorySnapshots: []
    };
  }

  async start() {
    console.log(`\n=== LONG-RUN STABILITY TEST ===`);
    console.log(`Running ${this.clientCount} clients for ${this.testDuration / 60000} minutes`);
    console.log(`Test started at: ${new Date().toISOString()}\n`);

    this.running = true;
    this.startTime = Date.now();

    // Create and connect clients
    await this.createAndConnectClients();

    // Start monitoring
    this.startMonitoring();

    // End test after duration
    setTimeout(() => {
      this.running = false;
      this.endTest();
    }, this.testDuration);
  }

  async createAndConnectClients() {
    console.log('Creating and connecting clients...');
    
    for (let i = 0; i < this.clientCount; i++) {
      const client = new TestClient(`LONGRUN-${i}`);
      
      // Add enhanced event tracking
      const originalHandleMessage = client.handleMessage.bind(client);
      client.handleMessage = (message) => {
        if (message.type === 'new_job') {
          this.stats.jobUpdates++;
        }
        originalHandleMessage(message);
      };

      // Track disconnects
      const originalDisconnect = client.disconnect.bind(client);
      client.disconnect = () => {
        this.stats.disconnections++;
        originalDisconnect();
      };

      this.clients.push(client);
    }

    // Connect all clients
    const connectPromises = this.clients.map(async (client) => {
      try {
        await client.connect();
        console.log(`Client ${client.id} connected`);
      } catch (error) {
        console.log(`Failed to connect client ${client.id}: ${error.message}`);
        this.stats.errors++;
        
        // Try reconnect
        setTimeout(() => this.reconnectClient(client), 2000);
      }
    });

    await Promise.allSettled(connectPromises);
    console.log('All clients connection attempted');
  }

  reconnectClient(client) {
    if (!this.running) return;
    
    this.stats.reconnectAttempts++;
    console.log(`Attempting to reconnect client ${client.id} (attempt #${this.stats.reconnectAttempts})`);

    client.connect().then(() => {
      this.stats.successfulReconnects++;
      console.log(`Client ${client.id} reconnected successfully`);
    }).catch(error => {
      this.stats.failedReconnects++;
      this.stats.errors++;
      console.log(`Failed to reconnect client ${client.id}: ${error.message}`);
      
      // Schedule another reconnect attempt
      if (this.running) {
        setTimeout(() => this.reconnectClient(client), 5000);
      }
    });
  }

  startMonitoring() {
    // Status logging every 30 seconds
    const statusInterval = setInterval(() => {
      if (!this.running) {
        clearInterval(statusInterval);
        return;
      }
      this.logStatus();
    }, 30000);

    // Memory snapshot every 2 minutes
    const memoryInterval = setInterval(() => {
      if (!this.running) {
        clearInterval(memoryInterval);
        return;
      }
      this.takeMemorySnapshot();
    }, 120000);

    // Periodic reconnect test (random client)
    const reconnectInterval = setInterval(() => {
      if (!this.running) {
        clearInterval(reconnectInterval);
        return;
      }
      this.testRandomReconnect();
    }, 45000);
  }

  logStatus() {
    const elapsed = Date.now() - this.startTime;
    const elapsedMinutes = (elapsed / 60000).toFixed(1);
    
    const connectedCount = this.clients.filter(c => c.connected).length;
    
    console.log(`\n--- STATUS UPDATE (${elapsedMinutes}m elapsed) ---`);
    console.log(`Connected clients: ${connectedCount}/${this.clientCount}`);
    console.log(`Job updates: ${this.stats.jobUpdates}`);
    console.log(`Reconnect attempts: ${this.stats.reconnectAttempts}`);
    console.log(`Errors: ${this.stats.errors}`);
    console.log(`Disconnections: ${this.stats.disconnections}`);
    
    // Check for any clients without jobs
    const clientsWithoutJobs = this.clients.filter(c => c.receivedJobs.size === 0).length;
    if (clientsWithoutJobs > 0) {
      console.log(`WARNING: ${clientsWithoutJobs} clients have not received jobs`);
    }
  }

  takeMemorySnapshot() {
    const memUsage = process.memoryUsage();
    const snapshot = {
      timestamp: Date.now(),
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      connectedClients: this.clients.filter(c => c.connected).length
    };
    
    this.stats.memorySnapshots.push(snapshot);
    
    console.log(`\n--- MEMORY SNAPSHOT ---`);
    console.log(`RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Connected Clients: ${snapshot.connectedClients}`);
  }

  testRandomReconnect() {
    const connectedClients = this.clients.filter(c => c.connected);
    if (connectedClients.length === 0) return;

    const randomClient = connectedClients[Math.floor(Math.random() * connectedClients.length)];
    console.log(`Testing reconnect for client ${randomClient.id}`);
    
    randomClient.disconnect();
    setTimeout(() => this.reconnectClient(randomClient), 1000);
  }

  endTest() {
    console.log(`\n=== TEST COMPLETE ===`);
    console.log(`Test duration: ${((Date.now() - this.startTime) / 60000).toFixed(1)} minutes`);
    
    // Disconnect all clients
    this.clients.forEach(client => {
      if (client.connected) {
        client.disconnect();
      }
    });

    // Final analysis
    this.analyzeLongRunResults();
  }

  analyzeLongRunResults() {
    console.log(`\n--- LONG-RUN STABILITY ANALYSIS ---`);
    
    const totalTestTime = Date.now() - this.startTime;
    const testMinutes = totalTestTime / 60000;

    console.log(`--- CONNECTION STABILITY ---`);
    console.log(`Test duration: ${testMinutes.toFixed(1)} minutes`);
    console.log(`Reconnect attempts: ${this.stats.reconnectAttempts}`);
    console.log(`Successful reconnects: ${this.stats.successfulReconnects}`);
    console.log(`Failed reconnects: ${this.stats.failedReconnects}`);
    console.log(`Total disconnections: ${this.stats.disconnections}`);
    
    const reconnectSuccessRate = this.stats.reconnectAttempts > 0 
      ? (this.stats.successfulReconnects / this.stats.reconnectAttempts * 100).toFixed(1)
      : 0;
    console.log(`Reconnect success rate: ${reconnectSuccessRate}%`);

    console.log(`\n--- JOB UPDATE STABILITY ---`);
    console.log(`Total job updates: ${this.stats.jobUpdates}`);
    console.log(`Job updates per minute: ${(this.stats.jobUpdates / testMinutes).toFixed(1)}`);
    
    // Analyze job distribution
    const jobStats = this.clients.map(client => ({
      id: client.id,
      jobCount: client.receivedJobs.size,
      eventCount: client.events.length
    }));
    
    const avgJobsPerClient = jobStats.reduce((sum, stat) => sum + stat.jobCount, 0) / jobStats.length;
    console.log(`Average jobs per client: ${avgJobsPerClient.toFixed(1)}`);
    
    const clientsWithJobs = jobStats.filter(stat => stat.jobCount > 0).length;
    console.log(`Clients that received jobs: ${clientsWithJobs}/${this.clientCount}`);

    console.log(`\n--- ERROR ANALYSIS ---`);
    console.log(`Total errors: ${this.stats.errors}`);
    console.log(`Error rate per minute: ${(this.stats.errors / testMinutes).toFixed(2)}`);
    
    if (this.stats.errors === 0) {
      console.log(`PASS: No errors during long-run test`);
    } else {
      console.log(`WARN: ${this.stats.errors} errors occurred`);
    }

    console.log(`\n--- MEMORY ANALYSIS ---`);
    if (this.stats.memorySnapshots.length > 1) {
      const firstSnapshot = this.stats.memorySnapshots[0];
      const lastSnapshot = this.stats.memorySnapshots[this.stats.memorySnapshots.length - 1];
      
      const memoryGrowth = lastSnapshot.heapUsed - firstSnapshot.heapUsed;
      const memoryGrowthMB = memoryGrowth / 1024 / 1024;
      
      console.log(`Initial heap: ${(firstSnapshot.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Final heap: ${(lastSnapshot.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Memory growth: ${memoryGrowthMB.toFixed(2)} MB`);
      console.log(`Growth rate: ${(memoryGrowthMB / testMinutes).toFixed(3)} MB/min`);
      
      if (memoryGrowthMB < 50) { // Less than 50MB growth
        console.log(`PASS: Acceptable memory usage growth`);
      } else {
        console.log(`WARN: High memory usage growth detected`);
      }
    }

    // Final validation
    console.log(`\n--- FINAL VALIDATION ---`);
    
    let passCount = 0;
    let totalChecks = 0;

    // Check 1: High reconnect success rate
    totalChecks++;
    if (parseFloat(reconnectSuccessRate) >= 80) {
      console.log(`PASS: Reconnect success rate >= 80%`);
      passCount++;
    } else {
      console.log(`FAIL: Low reconnect success rate`);
    }

    // Check 2: All clients received jobs
    totalChecks++;
    if (clientsWithJobs === this.clientCount) {
      console.log(`PASS: All clients received jobs`);
      passCount++;
    } else {
      console.log(`FAIL: Some clients never received jobs`);
    }

    // Check 3: No crashes (test completed)
    totalChecks++;
    console.log(`PASS: Test completed without crashes`);
    passCount++;

    // Check 4: Acceptable error rate
    totalChecks++;
    if (this.stats.errors / testMinutes < 1) { // Less than 1 error per minute
      console.log(`PASS: Acceptable error rate`);
      passCount++;
    } else {
      console.log(`FAIL: High error rate`);
    }

    console.log(`\n--- FINAL RESULT ---`);
    console.log(`Tests passed: ${passCount}/${totalChecks}`);
    console.log(`Overall stability: ${passCount === totalChecks ? 'EXCELLENT' : passCount >= totalChecks * 0.75 ? 'GOOD' : 'NEEDS IMPROVEMENT'}`);
  }
}

// Run test if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const isShort = args.includes('--short');
  
  let clientCount, durationMinutes;
  
  if (isShort) {
    clientCount = 4;
    durationMinutes = 2; // 2 minutes for short mode
  } else {
    clientCount = parseInt(args.find(arg => !arg.startsWith('--'))) || 6;
    durationMinutes = parseInt(args[1]) || 10;
  }
  
  const test = new LongRunTest(clientCount, durationMinutes);
  test.start().catch(console.error);
}

module.exports = LongRunTest;
