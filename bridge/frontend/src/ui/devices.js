/**
 * Bitmind v7 Device Network Component
 * Real-time device visualization with animated nodes
 */

class BitmindDeviceNetwork {
    constructor() {
        this.ready = Promise.resolve(this.initialize());
        this.devices = new Map();
        this.deviceGrid = null;
        this.maxDevices = 50;
    }

    async initialize() {
        console.log('[DeviceNetwork] Initializing device network component...');
        
        // Setup device grid
        this.setupDeviceGrid();
        
        // Bind events
        this.bindEvents();
        
        // Load initial devices
        await this.loadInitialDevices();
        
        console.log('[DeviceNetwork] Device network component ready');
    }

    setupDeviceGrid() {
        this.deviceGrid = document.getElementById('deviceGrid');
        if (!this.deviceGrid) {
            console.error('[DeviceNetwork] Device grid not found');
            return;
        }
    }

    bindEvents() {
        // Device node interactions
        this.deviceGrid.addEventListener('click', (e) => {
            const deviceNode = e.target.closest('.device-node');
            if (deviceNode) {
                this.selectDevice(deviceNode);
            }
        });

        // Hover effects
        this.deviceGrid.addEventListener('mouseover', (e) => {
            const deviceNode = e.target.closest('.device-node');
            if (deviceNode) {
                this.highlightDevice(deviceNode);
            }
        });

        this.deviceGrid.addEventListener('mouseout', (e) => {
            const deviceNode = e.target.closest('.device-node');
            if (deviceNode) {
                this.unhighlightDevice(deviceNode);
            }
        });
    }

    async loadInitialDevices() {
        try {
            const response = await fetch('http://localhost:3001/mining/devices');
            if (response.ok) {
                const data = await response.json();
                data.devices.forEach(device => {
                    this.addDevice(device);
                });
            }
        } catch (error) {
            console.error('[DeviceNetwork] Failed to load initial devices:', error);
        }
    }

    addDevice(deviceData) {
        const deviceId = deviceData.device_id;
        
        // Update device data
        this.devices.set(deviceId, {
            ...deviceData,
            lastSeen: new Date(),
            animationState: 'idle'
        });

        // Update UI
        this.renderDevice(deviceData);
        this.updateDeviceCounts();
    }

    updateDevice(deviceData) {
        const deviceId = deviceData.device_id;
        const existingDevice = this.devices.get(deviceId);
        
        if (!existingDevice) {
            this.addDevice(deviceData);
            return;
        }

        // Update device data
        this.devices.set(deviceId, {
            ...existingDevice,
            ...deviceData,
            lastSeen: new Date()
        });

        // Update UI
        this.renderDevice(deviceData);
        
        // Trigger animation for status change
        if (deviceData.online !== existingDevice.online) {
            this.animateDeviceStatus(deviceId, deviceData.online);
        }
    }

    renderDevice(deviceData) {
        const deviceId = deviceData.device_id;
        let deviceNode = document.getElementById(`device-${deviceId}`);
        
        if (!deviceNode) {
            deviceNode = this.createDeviceNode(deviceData);
            this.deviceGrid.appendChild(deviceNode);
        }

        // Update device node content
        this.updateDeviceNode(deviceNode, deviceData);
        
        // Update device node appearance
        this.updateDeviceAppearance(deviceNode, deviceData);
    }

    createDeviceNode(deviceData) {
        const deviceNode = document.createElement('div');
        deviceNode.id = `device-${deviceData.device_id}`;
        deviceNode.className = 'device-node';
        deviceNode.dataset.deviceId = deviceData.device_id;
        
        // Use device name if available, fallback to device_id
        const displayName = deviceData.name || deviceData.device_id;
        const isOnline = deviceData.online || false;
        const hashrate = deviceData.estimated_hashrate || '0 MH/s';
        const lastSeen = deviceData.last_seen ? this.formatLastSeen(deviceData.last_seen) : 'Never';
        
        deviceNode.innerHTML = `
            <div class="device-header">
                <div class="device-avatar">
                    <div class="avatar-icon">⛏️</div>
                    <div class="status-indicator ${isOnline ? 'online' : 'offline'}"></div>
                </div>
                <div class="device-title">
                    <div class="device-name">${displayName}</div>
                    <div class="device-id">${deviceData.device_id}</div>
                </div>
                <div class="device-actions">
                    <button class="action-btn" title="View Details">
                        <span class="action-icon">ℹ️</span>
                    </button>
                </div>
            </div>
            
            <div class="device-body">
                <div class="device-status-row">
                    <div class="status-badge ${isOnline ? 'online' : 'offline'}">
                        <span class="status-dot"></span>
                        <span class="status-text">${isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                    <div class="last-seen">
                        <span class="last-seen-label">Last seen:</span>
                        <span class="last-seen-value">${lastSeen}</span>
                    </div>
                </div>
                
                <div class="device-metrics">
                    <div class="metric-item">
                        <div class="metric-label">Hashrate</div>
                        <div class="metric-value">${hashrate}</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-label">Shares</div>
                        <div class="metric-value">
                            <span class="accepted">${deviceData.accepted_shares || 0}</span>/
                            <span class="rejected">${deviceData.rejected_shares || 0}</span>
                        </div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-label">Acceptance</div>
                        <div class="metric-value acceptance-rate">${this.calculateAcceptanceRate(deviceData)}%</div>
                    </div>
                </div>
                
                ${deviceData.wallet ? `
                <div class="wallet-info">
                    <div class="wallet-label">Wallet:</div>
                    <div class="wallet-address">${this.formatWalletAddress(deviceData.wallet)}</div>
                </div>
                ` : ''}
                
                ${deviceData.worker ? `
                <div class="worker-info">
                    <div class="worker-label">Worker:</div>
                    <div class="worker-name">${deviceData.worker}</div>
                </div>
                ` : ''}
            </div>
            
            <div class="device-pulse"></div>
        `;
        
        return deviceNode;
    }

    updateDeviceNode(deviceNode, deviceData) {
        // Update stats
        const acceptedEl = deviceNode.querySelector('.accepted');
        const rejectedEl = deviceNode.querySelector('.rejected');
        
        if (acceptedEl) {
            this.animateValue(acceptedEl, deviceData.accepted_shares || 0);
        }
        
        if (rejectedEl) {
            this.animateValue(rejectedEl, deviceData.rejected_shares || 0);
        }
    }

    updateDeviceAppearance(deviceNode, deviceData) {
        // Update online/offline status
        if (deviceData.online) {
            deviceNode.classList.add('online');
            deviceNode.classList.remove('offline');
        } else {
            deviceNode.classList.add('offline');
            deviceNode.classList.remove('online');
        }
        
        // Update status indicator
        const statusEl = deviceNode.querySelector('.device-status');
        if (statusEl) {
            statusEl.className = `device-status ${deviceData.online ? 'online' : 'offline'}`;
        }
        
        // Update pulse animation
        const pulseEl = deviceNode.querySelector('.device-pulse');
        if (pulseEl) {
            if (deviceData.online && (deviceData.accepted_shares > 0 || deviceData.rejected_shares > 0)) {
                pulseEl.classList.add('active');
            } else {
                pulseEl.classList.remove('active');
            }
        }
    }

    animateDeviceStatus(deviceId, isOnline) {
        const deviceNode = document.getElementById(`device-${deviceId}`);
        if (!deviceNode) return;
        
        // Add status change animation
        deviceNode.classList.add('status-changing');
        
        setTimeout(() => {
            deviceNode.classList.remove('status-changing');
        }, 1000);
        
        // Create status notification
        this.createStatusNotification(deviceId, isOnline);
    }

    createStatusNotification(deviceId, isOnline) {
        const deviceNode = document.getElementById(`device-${deviceId}`);
        if (!deviceNode) return;
        
        const notification = document.createElement('div');
        notification.className = `device-notification ${isOnline ? 'online' : 'offline'}`;
        notification.textContent = isOnline ? '🟢 ONLINE' : '🔴 OFFLINE';
        
        deviceNode.appendChild(notification);
        
        // Remove notification after animation
        setTimeout(() => {
            notification.remove();
        }, 2000);
    }

    selectDevice(deviceNode) {
        // Remove previous selection
        document.querySelectorAll('.device-node').forEach(node => {
            node.classList.remove('selected');
        });
        
        // Add selection to clicked device
        deviceNode.classList.add('selected');
        
        // Show device details
        this.showDeviceDetails(deviceNode.dataset.deviceId);
    }

    highlightDevice(deviceNode) {
        deviceNode.classList.add('highlighted');
    }

    unhighlightDevice(deviceNode) {
        deviceNode.classList.remove('highlighted');
    }

    showDeviceDetails(deviceId) {
        const device = this.devices.get(deviceId);
        if (!device) return;
        
        // This could show a modal or sidebar with detailed device information
        console.log('[DeviceNetwork] Device details:', device);
        
        // For now, just log the details
        const details = {
            id: device.device_id,
            online: device.online,
            acceptedShares: device.accepted_shares,
            rejectedShares: device.rejected_shares,
            acceptanceRate: device.acceptance_rate,
            hashrate: device.estimated_hashrate,
            lastSeen: device.last_seen
        };
        
        console.table(details);
    }

    updateDeviceCounts() {
        const onlineCount = Array.from(this.devices.values()).filter(d => d.online).length;
        const totalCount = this.devices.size;
        
        // Update UI counters
        const onlineCountEl = document.getElementById('onlineCount');
        const totalCountEl = document.getElementById('totalCount');
        
        if (onlineCountEl) {
            this.animateValue(onlineCountEl, onlineCount);
        }
        
        if (totalCountEl) {
            this.animateValue(totalCountEl, totalCount);
        }
    }

    animateValue(element, value) {
        const current = parseInt(element.textContent) || 0;
        const target = parseInt(value) || 0;
        const duration = 300;
        const steps = 10;
        const increment = (target - current) / steps;
        let step = 0;
        
        const timer = setInterval(() => {
            step++;
            const newValue = Math.round(current + (increment * step));
            element.textContent = newValue;
            
            if (step >= steps) {
                clearInterval(timer);
                element.textContent = target;
            }
        }, duration / steps);
    }

    // Handle share submission animation
    animateShareSubmission(deviceId, accepted) {
        const deviceNode = document.getElementById(`device-${deviceId}`);
        if (!deviceNode) return;
        
        // Add share animation class
        deviceNode.classList.add(accepted ? 'share-accepted' : 'share-rejected');
        
        // Create share notification
        const shareNotification = document.createElement('div');
        shareNotification.className = `share-notification ${accepted ? 'accepted' : 'rejected'}`;
        shareNotification.textContent = accepted ? '✓' : '✗';
        
        deviceNode.appendChild(shareNotification);
        
        // Remove animation after completion
        setTimeout(() => {
            deviceNode.classList.remove('share-accepted', 'share-rejected');
            shareNotification.remove();
        }, 1500);
    }

    // Remove device
    removeDevice(deviceId) {
        const deviceNode = document.getElementById(`device-${deviceId}`);
        if (deviceNode) {
            deviceNode.classList.add('removing');
            setTimeout(() => {
                deviceNode.remove();
            }, 500);
        }
        
        this.devices.delete(deviceId);
        this.updateDeviceCounts();
    }

    // Clear all devices
    clearDevices() {
        this.devices.clear();
        this.deviceGrid.innerHTML = '<div class="no-devices">NO DEVICES CONNECTED</div>';
        this.updateDeviceCounts();
    }

    // Get device statistics
    getDeviceStats() {
        const devices = Array.from(this.devices.values());
        const online = devices.filter(d => d.online).length;
        const total = devices.length;
        const totalAccepted = devices.reduce((sum, d) => sum + (d.accepted_shares || 0), 0);
        const totalRejected = devices.reduce((sum, d) => sum + (d.rejected_shares || 0), 0);
        
        return {
            online,
            total,
            totalAccepted,
            totalRejected,
            acceptanceRate: total > 0 ? (totalAccepted / (totalAccepted + totalRejected)) * 100 : 0
        };
    }

    formatLastSeen(lastSeen) {
        const now = new Date();
        const lastSeenDate = new Date(lastSeen);
        const diffMs = now - lastSeenDate;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) {
            return 'Just now';
        } else if (diffMins < 60) {
            return `${diffMins}m ago`;
        } else if (diffMins < 1440) {
            return `${Math.floor(diffMins / 60)}h ago`;
        } else {
            return lastSeenDate.toLocaleDateString();
        }
    }

    formatWalletAddress(address) {
        if (!address) return '';
        return `${address.substring(0, 8)}...${address.substring(address.length - 8)}`;
    }

    calculateAcceptanceRate(deviceData) {
        const accepted = deviceData.accepted_shares || 0;
        const rejected = deviceData.rejected_shares || 0;
        const total = accepted + rejected;
        
        if (total === 0) return '0.0';
        return ((accepted / total) * 100).toFixed(1);
    }

    updateDeviceList(devices) {
        // Clear existing devices
        this.deviceGrid.innerHTML = '';
        
        if (devices.length === 0) {
            this.deviceGrid.innerHTML = '<div class="no-devices">NO MINERS CONNECTED</div>';
            return;
        }
        
        // Add all devices
        devices.forEach(device => {
            this.addDevice(device);
        });
        
        this.updateDeviceCounts();
    }
}

// Export for use in main app
window.BitmindDeviceNetwork = BitmindDeviceNetwork;
