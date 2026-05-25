/**
 * WebSocket Service
 * Centralized WebSocket connection management
 * DO NOT CHANGE ENDPOINTS - preserves existing backend compatibility
 */

class WebSocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.url = window.location.protocol === 'https:' ? 'wss://' + window.location.host + '/ws' : 'ws://' + window.location.host + '/ws';
  }

  /**
   * Add event listener
   * @param {string} event - Event type (open, message, error, close)
   * @param {Function} callback - Callback function
   */
  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event type
   * @param {Function} callback - Callback function
   */
  removeListener(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   * @param {string} event - Event type
   * @param {any} data - Event data
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Connect to WebSocket
   * @returns {Promise} Connection promise
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        console.log('=== CONNECTING WEBSOCKET ===');
        console.log('WebSocket URL:', this.url);
        
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('=== WEBSOCKET OPENED ===');
          console.log('WebSocket state:', this.ws.readyState);
          console.log('WebSocket URL:', this.ws.url);
          
          this.reconnectAttempts = 0;
          this.emit('open', { connected: true });
          resolve();
        };

        this.ws.onmessage = (event) => {
          console.log('=== WEBSOCKET MESSAGE RECEIVED ===');
          console.log('Raw data:', event.data);
          console.log('Data type:', typeof event.data);
          console.log('Data size:', event.data.length);
          
          try {
            const message = JSON.parse(event.data);
            console.log('Parsed message:', message);
            this.emit('message', message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            console.error('Raw message that failed:', event.data);
            this.emit('error', { type: 'parse_error', error, raw: event.data });
          }
        };

        this.ws.onclose = (event) => {
          console.log('=== WEBSOCKET CLOSED ===');
          console.log('Close code:', event.code);
          console.log('Close reason:', event.reason);
          console.log('Was clean:', event.wasClean);
          console.log('WebSocket readyState after close:', this.ws?.readyState);
          
          this.emit('close', { 
            code: event.code, 
            reason: event.reason, 
            wasClean: event.wasClean 
          });

          // Attempt to reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${this.reconnectDelay}ms...`);
            setTimeout(() => this.connect(), this.reconnectDelay);
          } else {
            console.log('Max reconnection attempts reached');
            this.emit('maxReconnectAttemptsReached');
          }
        };

        this.ws.onerror = (error) => {
          console.log('=== WEBSOCKET ERROR ===');
          console.error('WebSocket error:', error);
          console.error('Error details:', {
            error: error,
            readyState: this.ws?.readyState,
            url: this.ws?.url
          });
          this.emit('error', { type: 'websocket_error', error });
        };

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      console.log('Manually disconnecting WebSocket');
      this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Get connection status
   * @returns {string} Connection status
   */
  getStatus() {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'disconnecting';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }

  /**
   * Send message through WebSocket
   * @param {Object} data - Data to send
   * @returns {boolean} Send success
   */
  send(data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send message - WebSocket not connected');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      return false;
    }
  }
}

// New WebSocket connection function for Connect Miner button
let socket = null;

export function connectWebSocket(onMessage) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log("WebSocket already connected");
    return socket;
  }

  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log("WebSocket connected");

    socket.send(JSON.stringify({
      type: "register",
      deviceId: "web-client-" + Date.now(),
      source: "frontend"
    }));
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (onMessage) onMessage(data);
    } catch (err) {
      console.error("Invalid WS message:", err);
    }
  };

  socket.onclose = () => {
    console.log("WebSocket disconnected");
  };

  socket.onerror = (err) => {
    console.error("WebSocket error:", err);
  };

  return socket;
}

// Singleton instance
const wsService = new WebSocketService();

export default wsService;
