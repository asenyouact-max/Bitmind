const WebSocket = require('ws');

// Centralized WebSocket URL
const WS_URL = process.env.WS_URL || "ws://localhost:3001/ws/mining";

/**
 * Shared WebSocket client logic for Bitmind mining tests
 */
class TestClient {
  constructor(id, endpoint = WS_URL) {
    this.id = id;
    this.endpoint = endpoint;
    this.ws = null;
    this.connected = false;
    this.receivedJobs = new Set();
    this.connectionCount = 0;
    this.lastJobId = null;
    this.events = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.log(`[Client ${this.id}] Connecting to: ${this.endpoint}`);
      
      this.ws = new WebSocket(this.endpoint);
      this.connectionCount++;

      this.ws.on('open', () => {
        this.connected = true;
        console.log(`[Client ${this.id}] Connected successfully`);
        this.logEvent('CONNECT', `Client ${this.id} connected (attempt #${this.connectionCount})`);
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          this.logEvent('ERROR', `Failed to parse message: ${error.message}`);
        }
      });

      this.ws.on('close', (code, reason) => {
        this.connected = false;
        this.logEvent('DISCONNECT', `Client ${this.id} disconnected - Code: ${code}, Reason: ${reason || 'none'}`);
      });

      this.ws.on('error', (error) => {
        console.error(`[Client ${this.id}] WS Error:`, error.message);
        this.logEvent('ERROR', `Client ${this.id} error: ${error.message}`);
        reject(error);
      });

      // Timeout for connection
      setTimeout(() => {
        if (!this.connected) {
          console.error(`[Client ${this.id}] Connection timeout after 5000ms`);
          reject(new Error('Connection timeout'));
        }
      }, 5000);
    });
  }

  disconnect() {
    if (this.ws && this.connected) {
      this.ws.close();
      this.logEvent('DISCONNECT', `Client ${this.id} manual disconnect`);
    }
  }

  handleMessage(message) {
    this.logEvent('MESSAGE', `Client ${this.id} received: ${message.type}`);

    switch (message.type) {
      case 'welcome':
        this.logEvent('WELCOME', `Client ${this.id} welcomed: ${message.message}`);
        break;
      
      case 'new_job':
        const jobId = message.data?.job_id;
        if (jobId) {
          this.receivedJobs.add(jobId);
          this.lastJobId = jobId;
          this.logEvent('JOB', `Client ${this.id} received job: ${jobId}`);
        } else {
          this.logEvent('ERROR', `Client ${this.id} received new_job without job_id`);
        }
        break;
      
      case 'pong':
        this.logEvent('PONG', `Client ${this.id} received pong`);
        break;
      
      case 'error':
        this.logEvent('ERROR', `Client ${this.id} server error: ${message.error}`);
        break;
      
      default:
        this.logEvent('UNKNOWN', `Client ${this.id} unknown message type: ${message.type}`);
    }
  }

  ping() {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      this.logEvent('PING', `Client ${this.id} sent ping`);
    }
  }

  logEvent(type, message) {
    const event = {
      timestamp: new Date().toISOString(),
      client: this.id,
      type,
      message
    };
    this.events.push(event);
    console.log(`[${event.timestamp}] [${type}] ${message}`);
  }

  getStats() {
    return {
      id: this.id,
      connected: this.connected,
      connectionCount: this.connectionCount,
      receivedJobs: Array.from(this.receivedJobs),
      lastJobId: this.lastJobId,
      eventCount: this.events.length
    };
  }

  getEvents(type = null) {
    return type ? this.events.filter(e => e.type === type) : this.events;
  }
}

module.exports = TestClient;
