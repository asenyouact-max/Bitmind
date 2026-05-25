/**
 * Bitmind Device Manager - Plug & Play System
 * Handles auto-discovery and real-time updates of ESP32 miners
 */

class BitmindDeviceManager {
    constructor() {
        this.devices = new Map();
        this.ws = null;
        this.refreshInterval = null;
        this.isInitialized = false;
        
        // DOM elements
        this.deviceGrid = document.getElementById('deviceGrid');
        this.onlineCount = document.getElementById('onlineCount');
        this.totalCount = document.getElementById('totalCount');
        
        this.init();
    }

    async init() {
        console.log('[DeviceManager] Initializing plug & play device system...');
        
        try {
            // Start WebSocket connection for real-time updates
            await this.initWebSocket();
            
            // Initial device load
            await this.loadDevices();
            
            // Start periodic refresh
            this.startPeriodicRefresh();
            
            this.isInitialized = true;
            console.log('[DeviceManager] Device manager initialized successfully');
            
        } catch (error) {
            console.error('[DeviceManager] Initialization failed:', error);
            this.showError('Failed to initialize device manager');
        }
    }

    async initWebSocket() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.hostname}:3001`;
            
            console.log('[DeviceManager] Connecting WebSocket:', wsUrl);
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('[DeviceManager] WebSocket connected');
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('[DeviceManager] Failed to parse WebSocket message:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('[DeviceManager] WebSocket disconnected');
                // Attempt to reconnect after 5 seconds
                setTimeout(() => this.initWebSocket(), 5000);
            };
            
            this.ws.onerror = (error) => {
                console.error('[DeviceManager] WebSocket error:', error);
            };
            
        } catch (error) {
            console.error('[DeviceManager] WebSocket initialization failed:', error);
            // Fallback to polling only
        }
    }

    handleWebSocketMessage(data) {
        if (data.type === 'device_update') {
            console.log('[DeviceManager] Device update received:', data);
            
            switch (data.action) {
                case 'registered':
                    this.handleDeviceRegistered(data.device);
                    break;
                case 'reconnected':
                    this.handleDeviceReconnected(data.device);
                    break;
                case 'state_changed':
                    this.handleDeviceStatusChanged(data.device);
                    break;
                case 'removed':
                    this.handleDeviceRemoved(data.device);
                    break;
                default:
                    console.log('[DeviceManager] Unknown device action:', data.action);
            }
        }
    }

    async loadDevices() {
        try {
            console.log('[DeviceManager] Loading devices from backend...');
            
            const response = await fetch('/devices');
            const data = await response.json();
            
            if (data.status === 'success') {
                this.devices.clear();
                data.devices.forEach(device => {
                    this.devices.set(device.device_id, device);
                });
                
                this.renderDevices();
                console.log(`[DeviceManager] Loaded ${data.devices.length} devices`);
            } else {
                throw new Error(data.message || 'Failed to load devices');
            }
            
        } catch (error) {
            console.error('[DeviceManager] Failed to load devices:', error);
            this.showError('Failed to load devices');
        }
    }

    handleDeviceRegistered(device) {
        console.log('[DeviceManager] New device registered:', device.device_id);
        this.devices.set(device.device_id, device);
        this.renderDevices();
        this.showNotification(`New device connected: ${device.device_id}`, 'success');
    }

    handleDeviceStatusChanged(device) {
        console.log('[DeviceManager] Device status changed:', device.device_id, device.status, device.state_change_reason);
        
        const existingDevice = this.devices.get(device.device_id);
        if (existingDevice) {
            const oldStatus = existingDevice.status;
            this.devices.set(device.device_id, device);
            this.renderDevices();
            
            if (oldStatus !== device.status) {
                let message = '';
                let notificationType = 'info';
                
                switch (device.status) {
                    case 'online':
                        message = `Device ${device.device_id} is online`;
                        notificationType = 'success';
                        break;
                    case 'offline':
                        message = `Device ${device.device_id} went offline`;
                        notificationType = 'warning';
                        break;
                    case 'reconnecting':
                        message = `Device ${device.device_id} is reconnecting...`;
                        notificationType = 'info';
                        break;
                    case 'error':
                        message = `Device ${device.device_id} encountered an error`;
                        notificationType = 'error';
                        break;
                }
                
                if (device.state_change_reason) {
                    message += ` (${device.state_change_reason})`;
                }
                
                this.showNotification(message, notificationType);
            }
        }
    }

    handleDeviceReconnected(device) {
        console.log('[DeviceManager] Device reconnected:', device.device_id);
        this.devices.set(device.device_id, device);
        this.renderDevices();
        this.showNotification(`Device ${device.device_id} reconnected successfully`, 'success');
    }

    handleDeviceRemoved(device) {
        console.log('[DeviceManager] Device removed:', device.device_id);
        this.devices.delete(device.device_id);
        this.renderDevices();
        this.showNotification(`Device ${device.device_id} removed from system`, 'warning');
    }

    renderDevices() {
        if (!this.deviceGrid) return;
        
        const deviceArray = Array.from(this.devices.values());
        
        // Update counts
        const onlineCount = deviceArray.filter(d => d.status === 'online').length;
        const totalCount = deviceArray.length;
        
        if (this.onlineCount) this.onlineCount.textContent = onlineCount;
        if (this.totalCount) this.totalCount.textContent = totalCount;
        
        // Render device grid
        if (deviceArray.length === 0) {
            this.deviceGrid.innerHTML = `
                <div class="no-devices">
                    <div class="no-devices-icon">🔍</div>
                    <div class="no-devices-text">NO DEVICES CONNECTED</div>
                    <div class="no-devices-hint">Connect ESP32 miners to see them here</div>
                </div>
            `;
        } else {
            this.deviceGrid.innerHTML = deviceArray.map(device => this.createDeviceCard(device)).join('');
        }
    }

    createDeviceCard(device) {
        const lastSeen = this.formatLastSeen(device.last_seen);
        const deviceType = device.type || 'esp32_miner';
        
        // Determine status styling and indicators
        let statusClass = '';
        let statusText = '';
        let statusIndicator = '';
        let canMine = false;
        
        switch (device.status) {
            case 'online':
                statusClass = 'online';
                statusText = 'Online';
                statusIndicator = 'online';
                canMine = true;
                break;
            case 'offline':
                statusClass = 'offline';
                statusText = 'Offline';
                statusIndicator = 'offline';
                break;
            case 'reconnecting':
                statusClass = 'reconnecting';
                statusText = 'Reconnecting';
                statusIndicator = 'reconnecting';
                break;
            case 'error':
                statusClass = 'error';
                statusText = 'Error';
                statusIndicator = 'error';
                break;
            default:
                statusClass = 'unknown';
                statusText = 'Unknown';
                statusIndicator = 'unknown';
        }
        
        return `
            <div class="device-card ${statusClass}" data-device-id="${device.device_id}">
                <div class="device-header">
                    <div class="device-info">
                        <div class="device-name">${device.device_id}</div>
                        <div class="device-type">${this.formatDeviceType(deviceType)}</div>
                    </div>
                    <div class="device-status">
                        <div class="status-indicator ${statusIndicator}"></div>
                        <div class="status-text">${statusText}</div>
                    </div>
                </div>
                <div class="device-details">
                    <div class="device-detail">
                        <span class="detail-label">IP Address:</span>
                        <span class="detail-value">${device.ip}</span>
                    </div>
                    <div class="device-detail">
                        <span class="detail-label">Last Seen:</span>
                        <span class="detail-value">${lastSeen}</span>
                    </div>
                    <div class="device-detail">
                        <span class="detail-label">First Seen:</span>
                        <span class="detail-value">${this.formatDate(device.first_seen)}</span>
                    </div>
                    ${device.state_change_reason ? `
                        <div class="device-detail">
                            <span class="detail-label">Status Reason:</span>
                            <span class="detail-value">${device.state_change_reason}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="device-actions">
                    <button class="device-btn details-btn" onclick="deviceManager.showDeviceDetails('${device.device_id}')">
                        <span class="btn-icon">ℹ️</span>
                        Details
                    </button>
                    ${canMine ? `
                        <button class="device-btn mining-btn" onclick="deviceManager.showMiningStats('${device.device_id}')">
                            <span class="btn-icon">⛏️</span>
                            Mining
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    formatDeviceType(type) {
        const types = {
            'esp32_miner': 'ESP32 Miner',
            'esp32_dev': 'ESP32 Dev',
            'unknown': 'Unknown Device'
        };
        return types[type] || type;
    }

    formatLastSeen(lastSeen) {
        const date = new Date(lastSeen);
        const now = new Date();
        const diffMs = now - date;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        
        if (diffSecs < 60) {
            return 'Just now';
        } else if (diffMins < 60) {
            return `${diffMins}m ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString();
    }

    showDeviceDetails(deviceId) {
        const device = this.devices.get(deviceId);
        if (!device) return;
        
        console.log('[DeviceManager] Showing details for:', deviceId);
        
        // Create a simple modal with device details
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Device Details</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="device-details-full">
                        <div class="detail-row">
                            <span class="detail-label">Device ID:</span>
                            <span class="detail-value">${device.device_id}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Type:</span>
                            <span class="detail-value">${this.formatDeviceType(device.type)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">IP Address:</span>
                            <span class="detail-value">${device.ip}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Status:</span>
                            <span class="detail-value">${device.status}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">First Seen:</span>
                            <span class="detail-value">${this.formatDate(device.first_seen)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Last Seen:</span>
                            <span class="detail-value">${this.formatDate(device.last_seen)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Registered At:</span>
                            <span class="detail-value">${this.formatDate(device.registered_at)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    showMiningStats(deviceId) {
        const device = this.devices.get(deviceId);
        if (!device) return;
        
        console.log('[DeviceManager] Showing mining stats for:', deviceId);
        this.showNotification(`Mining stats for ${deviceId} coming soon!`, 'info');
    }

    startPeriodicRefresh() {
        // Refresh devices every 3 seconds as fallback (faster than before)
        this.refreshInterval = setInterval(async () => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                await this.loadDevices();
            }
        }, 3000); // Reduced from 5s to 3s for faster updates
        
        console.log('[DeviceManager] Started periodic refresh (3s interval)');
    }

    stopPeriodicRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            console.log('[DeviceManager] Stopped periodic refresh');
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    showError(message) {
        console.error('[DeviceManager] Error:', message);
        this.showNotification(message, 'error');
    }

    // Public API
    async refreshDevices() {
        await this.loadDevices();
    }

    getDeviceCount() {
        return this.devices.size;
    }

    getOnlineDeviceCount() {
        return Array.from(this.devices.values()).filter(d => d.status === 'online').length;
    }

    destroy() {
        console.log('[DeviceManager] Destroying device manager...');
        
        // Stop periodic refresh
        this.stopPeriodicRefresh();
        
        // Close WebSocket
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        // Clear devices
        this.devices.clear();
        
        this.isInitialized = false;
    }
}

// Initialize device manager when DOM is ready
let deviceManager;

document.addEventListener('DOMContentLoaded', () => {
    deviceManager = new BitmindDeviceManager();
});

// Export for global access
window.deviceManager = deviceManager;
