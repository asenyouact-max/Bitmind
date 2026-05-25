class BitmindWebSocket {
    constructor() {
        this.ws = null;
        this.reconnectInterval = 3000;
        this.maxReconnectAttempts = 10;
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.eventHandlers = {};
        this.heartbeatInterval = null;
        
        // Initialize connection
        this.connect();
    }

    connect() {
        if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
            return;
        }

        this.isConnecting = true;
        this.updateConnectionStatus('Connecting...', 'connecting');

        try {
            // Use WSS for production, WS for development
            const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
            const wsHost = window.location.hostname === 'localhost' ? 'localhost:3001' : 'getbitmind.com';
            this.ws = new WebSocket(`${wsProtocol}${wsHost}/ws`);
            
            this.ws.onopen = () => {
                console.log('[WebSocket] Connected to Bitmind server');
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus('Connected', 'connected');
                this.startHeartbeat();
                this.emit('connected');
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('[WebSocket] Failed to parse message:', error);
                }
            };

            this.ws.onclose = (event) => {
                console.log('[WebSocket] Connection closed:', event.code, event.reason);
                this.isConnecting = false;
                this.updateConnectionStatus('Disconnected', 'disconnected');
                this.stopHeartbeat();
                this.emit('disconnected');
                
                // Attempt to reconnect
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.scheduleReconnect();
                } else {
                    this.updateConnectionStatus('Connection Failed', 'error');
                }
            };

            this.ws.onerror = (error) => {
                console.error('[WebSocket] Error:', error);
                this.updateConnectionStatus('Connection Error', 'error');
            };

        } catch (error) {
            console.error('[WebSocket] Connection failed:', error);
            this.isConnecting = false;
            this.updateConnectionStatus('Connection Failed', 'error');
            this.scheduleReconnect();
        }
    }

    handleMessage(message) {
        console.log('[WebSocket] Received message:', message);
        
        switch (message.type) {
            case 'welcome':
                this.emit('welcome', message);
                break;
            case 'new_job':
                this.emit('new_job', message.data);
                break;
            case 'block_update':
                this.emit('block_update', message.data);
                break;
            case 'device_event':
                this.emit('device_event', message.data);
                break;
            case 'pong':
                // Heartbeat response
                break;
            case 'ping':
                this.send('pong');
                break;
            case 'error':
                console.error('[WebSocket] Server error:', message.error);
                this.emit('error', message);
                break;
            default:
                console.log('[WebSocket] Unknown message type:', message.type);
                this.emit('unknown', message);
        }
    }

    send(type, data = null) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = {
                type: type,
                timestamp: Date.now()
            };
            
            if (data) {
                message.data = data;
            }
            
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('[WebSocket] Cannot send message - not connected');
        }
    }

    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
    }

    off(event, handler) {
        if (this.eventHandlers[event]) {
            const index = this.eventHandlers[event].indexOf(handler);
            if (index > -1) {
                this.eventHandlers[event].splice(index, 1);
            }
        }
    }

    emit(event, data = null) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error('[WebSocket] Event handler error:', error);
                }
            });
        }
    }

    scheduleReconnect() {
        this.reconnectAttempts++;
        console.log(`[WebSocket] Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        
        setTimeout(() => {
            this.connect();
        }, this.reconnectInterval);
    }

    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            this.send('ping');
        }, 30000); // 30 seconds
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    updateConnectionStatus(text, status) {
        const statusElement = document.getElementById('connectionStatus');
        const statusDot = statusElement.querySelector('.status-dot');
        const statusText = statusElement.querySelector('.status-text');
        
        statusText.textContent = text;
        statusDot.className = `status-dot ${status}`;
    }

    close() {
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    getConnectionState() {
        if (!this.ws) return 'disconnected';
        
        switch (this.ws.readyState) {
            case WebSocket.CONNECTING: return 'connecting';
            case WebSocket.OPEN: return 'connected';
            case WebSocket.CLOSING: return 'closing';
            case WebSocket.CLOSED: return 'disconnected';
            default: return 'unknown';
        }
    }
}

// Global WebSocket instance
let bitmindWS = null;

// Initialize WebSocket when page loads
document.addEventListener('DOMContentLoaded', () => {
    bitmindWS = new BitmindWebSocket();
});

// Export for use in other modules
window.BitmindWebSocket = BitmindWebSocket;
window.bitmindWS = bitmindWS;
