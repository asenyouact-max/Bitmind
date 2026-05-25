const TestClient = require('./client');

/**
 * TEST 2: MULTI-CLIENT SYNC TEST
 * 
 * Connects 5-10 clients simultaneously
 * Validates all clients receive the same job_id
 * Checks for duplicate "new_job" events per client
 */

class SyncTest {
  constructor(clientCount = 8) {
    this.clientCount = clientCount;
    this.clients = [];
    this.testDuration = 30000; // 30 seconds
    this.running = false;
    this.jobSyncMap = new Map(); // job_id -> array of client IDs
  }

  async start() {
    console.log(`\n=== MULTI-CLIENT SYNC TEST ===`);
    console.log(`Creating ${this.clientCount} simultaneous clients for ${this.testDuration/1000} seconds\n`);

    this.running = true;

    // Create clients
    for (let i = 0; i < this.clientCount; i++) {
      const client = new TestClient(`SYNC-${i}`);
      this.clients.push(client);
    }

    // Connect all clients simultaneously
    await this.connectAllClients();

    // Monitor for sync during test duration
    this.monitorSync();

    // End test after duration
    setTimeout(() => {
      this.running = false;
      this.endTest();
    }, this.testDuration);
  }

  async connectAllClients() {
    console.log('Connecting all clients simultaneously...');
    
    const connectPromises = this.clients.map(async (client) => {
      try {
        await client.connect();
      } catch (error) {
        console.log(`Failed to connect client ${client.id}: ${error.message}`);
      }
    });

    await Promise.allSettled(connectPromises);
    console.log('All clients connected');
  }

  monitorSync() {
    const monitorInterval = setInterval(() => {
      if (!this.running) {
        clearInterval(monitorInterval);
        return;
      }
      
      this.checkSync();
    }, 2000); // Check every 2 seconds
  }

  checkSync() {
    const currentJobs = new Map(); // client_id -> current job_id
    
    this.clients.forEach(client => {
      if (client.lastJobId) {
        currentJobs.set(client.id, client.lastJobId);
      }
    });

    if (currentJobs.size === 0) {
      return; // No jobs received yet
    }

    // Group clients by job_id
    const jobGroups = new Map();
    currentJobs.forEach((jobId, clientId) => {
      if (!jobGroups.has(jobId)) {
        jobGroups.set(jobId, []);
      }
      jobGroups.get(jobId).push(clientId);
    });

    // Check if all clients have the same job
    if (jobGroups.size === 1) {
      const [jobId, clients] = jobGroups.entries().next().value;
      console.log(`SYNC CHECK: All ${clients.length} clients have job ${jobId}`);
    } else {
      console.log(`SYNC WARNING: ${jobGroups.size} different jobs detected:`);
      jobGroups.forEach((clients, jobId) => {
        console.log(`  Job ${jobId}: ${clients.length} clients`);
      });
    }
  }

  endTest() {
    console.log(`\n=== TEST COMPLETE ===`);
    
    // Disconnect all clients
    this.clients.forEach(client => {
      if (client.connected) {
        client.disconnect();
      }
    });

    // Analyze sync results
    this.analyzeSyncResults();
  }

  analyzeSyncResults() {
    console.log(`\n--- SYNC TEST ANALYSIS ---`);
    
    const clientStats = new Map(); // client_id -> detailed stats
    const allJobIds = new Set();
    const jobToClients = new Map(); // job_id -> Set of client IDs

    this.clients.forEach(client => {
      const stats = client.getStats();
      clientStats.set(client.id, stats);
      
      stats.receivedJobs.forEach(jobId => {
        allJobIds.add(jobId);
        
        if (!jobToClients.has(jobId)) {
          jobToClients.set(jobId, new Set());
        }
        jobToClients.get(jobId).add(client.id);
      });

      console.log(`Client ${client.id}:`);
      console.log(`  Jobs received: ${stats.receivedJobs.length}`);
      console.log(`  Unique jobs: ${new Set(stats.receivedJobs).size}`);
      console.log(`  Total events: ${stats.eventCount}`);
      
      // Check for duplicates
      const jobCounts = {};
      stats.receivedJobs.forEach(jobId => {
        jobCounts[jobId] = (jobCounts[jobId] || 0) + 1;
      });
      
      const duplicates = Object.entries(jobCounts).filter(([jobId, count]) => count > 1);
      if (duplicates.length > 0) {
        console.log(`  DUPLICATES: ${duplicates.map(([jobId, count]) => `${jobId}(${count}x)`).join(', ')}`);
      }
    });

    console.log(`\n--- SYNC ANALYSIS ---`);
    console.log(`Total unique job IDs: ${allJobIds.size}`);
    console.log(`Jobs per client:`);
    
    const jobCountsPerClient = [];
    clientStats.forEach((stats, clientId) => {
      jobCountsPerClient.push(stats.receivedJobs.length);
    });
    
    const avgJobs = jobCountsPerClient.reduce((a, b) => a + b, 0) / jobCountsPerClient.length;
    console.log(`  Average: ${avgJobs.toFixed(1)}`);
    console.log(`  Min: ${Math.min(...jobCountsPerClient)}`);
    console.log(`  Max: ${Math.max(...jobCountsPerClient)}`);

    console.log(`\n--- JOB DISTRIBUTION ---`);
    jobToClients.forEach((clients, jobId) => {
      console.log(`Job ${jobId}: ${clients.size} clients (${Array.from(clients).join(', ')})`);
    });

    // Validation
    console.log(`\n--- VALIDATION ---`);
    
    // Check 1: All clients received jobs
    const clientsWithJobs = Array.from(clientStats.values()).filter(stats => stats.receivedJobs.length > 0).length;
    if (clientsWithJobs === this.clientCount) {
      console.log(`PASS: All ${this.clientCount} clients received at least one job`);
    } else {
      console.log(`FAIL: ${this.clientCount - clientsWithJobs} clients received no jobs`);
    }

    // Check 2: No duplicate jobs per client
    let duplicateCount = 0;
    clientStats.forEach((stats, clientId) => {
      const uniqueJobs = new Set(stats.receivedJobs);
      if (uniqueJobs.size < stats.receivedJobs.length) {
        duplicateCount += (stats.receivedJobs.length - uniqueJobs.size);
      }
    });
    
    if (duplicateCount === 0) {
      console.log(`PASS: No duplicate job receptions per client`);
    } else {
      console.log(`FAIL: ${duplicateCount} duplicate job receptions detected`);
    }

    // Check 3: All clients have same current job
    const currentJobs = new Set();
    this.clients.forEach(client => {
      if (client.lastJobId) {
        currentJobs.add(client.lastJobId);
      }
    });
    
    if (currentJobs.size <= 1) {
      console.log(`PASS: All clients synchronized to same job`);
    } else {
      console.log(`FAIL: Clients have different current jobs (${currentJobs.size} different)`);
    }

    // Check 4: Job distribution consistency
    if (allJobIds.size > 0) {
      const distribution = Array.from(jobToClients.values()).map(clients => clients.size);
      const minDistribution = Math.min(...distribution);
      const maxDistribution = Math.max(...distribution);
      
      if (minDistribution === maxDistribution) {
        console.log(`PASS: All jobs distributed to all clients (${minDistribution} each)`);
      } else {
        console.log(`WARN: Uneven job distribution (min: ${minDistribution}, max: ${maxDistribution})`);
      }
    }
  }
}

// Run test if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const isShort = args.includes('--short');
  const clientCount = isShort ? 5 : (parseInt(args.find(arg => !arg.startsWith('--'))) || 8);
  
  const test = new SyncTest(clientCount);
  if (isShort) {
    test.testDuration = 15000; // 15 seconds for short mode
  }
  test.start().catch(console.error);
}

module.exports = SyncTest;
