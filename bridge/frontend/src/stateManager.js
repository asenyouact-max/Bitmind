/**
 * Bitmind v7 State Manager
 * Centralized state management for the mining control room UI
 */

class BitmindStateManager {
    constructor() {
        this.state = {
            // System Overview
            system: {
                blockHeight: null,
                uptime: 0,
                health: 'unknown',
                lastUpdate: null
            },
            
            // Mining Job
            job: {
                jobId: null,
                target: null,
                previousBlockHash: null,
                height: null,
                lastUpdate: null
            },
            
            // Devices
            devices: new Map(),
            deviceStats: {
                online: 0,
                total: 0
            },
            
            // Mining Statistics
            mining: {
                totalShares: 0,
                acceptedShares: 0,
                rejectedShares: 0,
                acceptanceRate: 0,
                sharesPerMinute: [],
                performanceData: []
            },
            
            // Events
            events: [],
            eventFilters: {
                all: true,
                shares: false,
                jobs: false,
                devices: false
            },
            
            // Charts
            charts: {
                currentChart: 'shares',
                data: {
                    shares: [],
                    acceptance: [],
                    performance: []
                }
            },
            
            // UI State
            ui: {
                connectionState: 'disconnected',
                animations: {
                    jobUpdate: false,
                blockUpdate: false,
                    shareAccepted: false,
                    shareRejected: false,
                    deviceOnline: false
                }
            }
        };
        
        this.subscribers = new Map();
        this.maxEvents = 100;
        this.maxChartDataPoints = 60; // 60 data points for charts
        
        // Initialize periodic updates
        this.startPeriodicUpdates();
    }

    // Subscribe to state changes
    subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, []);
        }
        this.subscribers.get(key).push(callback);
        
        // Immediately call with current state
        callback(this.getState(key));
    }

    // Unsubscribe from state changes
    unsubscribe(key, callback) {
        if (this.subscribers.has(key)) {
            const callbacks = this.subscribers.get(key);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    // Get state (or specific key)
    getState(key = null) {
        if (key) {
            return this.getNestedValue(this.state, key);
        }
        return this.state;
    }

    // Set state and notify subscribers
    setState(key, value) {
        const oldValue = this.getNestedValue(this.state, key);
        this.setNestedValue(this.state, key, value);
        
        // Notify subscribers
        this.notifySubscribers(key, value, oldValue);
    }

    // Update state with merge
    updateState(key, updates) {
        const current = this.getNestedValue(this.state, key) || {};
        const newValue = typeof current === 'object' ? { ...current, ...updates } : updates;
        this.setState(key, newValue);
    }

    // Handle WebSocket events
    handleWebSocketEvent(eventType, data) {
        switch (eventType) {
            case 'new_job':
                this.handleNewJob(data);
                break;
            case 'block_update':
                this.handleBlockUpdate(data);
                break;
            case 'device_event':
                this.handleDeviceEvent(data);
                break;
            case 'connected':
                this.handleConnectionChange('connected');
                break;
            case 'disconnected':
                this.handleConnectionChange('disconnected');
                break;
        }
    }

    // Handle new job event
    handleNewJob(jobData) {
        this.setState('job', {
            jobId: jobData.job_id,
            target: jobData.target,
            previousBlockHash: jobData.previousblockhash,
            height: jobData.height,
            lastUpdate: new Date()
        });

        // Trigger animation
        this.triggerAnimation('jobUpdate');
        
        // Add event to feed
        this.addEvent({
            type: 'job',
            message: `New job: ${jobData.job_id}`,
            data: jobData,
            timestamp: new Date()
        });
    }

    // Handle block update event
    handleBlockUpdate(blockData) {
        this.setState('system.blockHeight', blockData.height);
        this.setState('system.lastUpdate', new Date());
        
        // Trigger animation
        this.triggerAnimation('blockUpdate');
        
        // Add event to feed
        this.addEvent({
            type: 'block',
            message: `Block height: ${blockData.height}`,
            data: blockData,
            timestamp: new Date()
        });
    }

    // Handle device event
    handleDeviceEvent(deviceData) {
        // Update device in registry
        const deviceId = deviceData.device_id;
        this.state.devices.set(deviceId, {
            ...this.state.devices.get(deviceId),
            ...deviceData,
            lastSeen: new Date()
        });
        
        // Update device counts
        this.updateDeviceCounts();
        
        // Trigger animation
        if (deviceData.online) {
            this.triggerAnimation('deviceOnline');
        }
        
        // Add event to feed
        this.addEvent({
            type: 'device',
            message: `Device ${deviceId}: ${deviceData.online ? 'online' : 'offline'}`,
            data: deviceData,
            timestamp: new Date()
        });
    }

    // Handle connection change
    handleConnectionChange(state) {
        this.setState('ui.connectionState', state);
    }

    // Handle share submission
    handleShareSubmission(shareData, accepted) {
        // Update mining statistics
        const current = this.state.mining;
        const newStats = {
            totalShares: current.totalShares + 1,
            acceptedShares: current.acceptedShares + (accepted ? 1 : 0),
            rejectedShares: current.rejectedShares + (accepted ? 0 : 1),
            acceptanceRate: ((current.acceptedShares + (accepted ? 1 : 0)) / (current.totalShares + 1)) * 100
        };
        
        this.setState('mining', newStats);
        
        // Update shares per minute chart
        this.updateSharesPerMinute(accepted);
        
        // Trigger animation
        this.triggerAnimation(accepted ? 'shareAccepted' : 'shareRejected');
        
        // Add event to feed
        this.addEvent({
            type: 'share',
            message: `Share ${accepted ? 'accepted' : 'rejected'} from ${shareData.device_id}`,
            data: shareData,
            accepted: accepted,
            timestamp: new Date()
        });
    }

    // Add event to feed
    addEvent(event) {
        this.state.events.unshift(event);
        
        // Keep only recent events
        if (this.state.events.length > this.maxEvents) {
            this.state.events = this.state.events.slice(0, this.maxEvents);
        }
        
        // Notify subscribers
        this.notifySubscribers('events', this.state.events);
    }

    // Trigger animation
    triggerAnimation(animationType) {
        this.setState(`ui.animations.${animationType}`, true);
        
        // Auto-disable animation after duration
        setTimeout(() => {
            this.setState(`ui.animations.${animationType}`, false);
        }, 1000);
    }

    // Update shares per minute chart data
    updateSharesPerMinute(accepted) {
        const now = new Date();
        const timeLabel = now.toLocaleTimeString();
        
        let sharesData = this.state.charts.data.shares;
        
        // Add new data point
        const newDataPoint = {
            time: timeLabel,
            accepted: accepted ? 1 : 0,
            rejected: accepted ? 0 : 1,
            timestamp: now.getTime()
        };
        
        sharesData.push(newDataPoint);
        
        // Keep only recent data points
        if (sharesData.length > this.maxChartDataPoints) {
            sharesData = sharesData.slice(-this.maxChartDataPoints);
        }
        
        this.setState('charts.data.shares', sharesData);
    }

    // Update device counts
    updateDeviceCounts() {
        const devices = Array.from(this.state.devices.values());
        const online = devices.filter(d => d.online).length;
        const total = devices.length;
        
        this.setState('deviceStats', { online, total });
    }

    // Start periodic updates
    startPeriodicUpdates() {
        setInterval(() => {
            // Update uptime
            if (this.state.ui.connectionState === 'connected') {
                this.setState('system.uptime', this.state.system.uptime + 1);
            }
            
            // Clean up old chart data
            this.cleanupOldData();
        }, 1000); // Update every second
    }

    // Clean up old data
    cleanupOldData() {
        const cutoff = Date.now() - (60 * 60 * 1000); // 1 hour ago
        
        // Clean up old events
        this.state.events = this.state.events.filter(event => 
            event.timestamp.getTime() > cutoff
        );
        
        // Clean up old chart data
        Object.keys(this.state.charts.data).forEach(chartType => {
            this.state.charts.data[chartType] = this.state.charts.data[chartType].filter(point =>
                point.timestamp > cutoff
            );
        });
    }

    // Helper methods for nested object access
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current && current[key], obj);
    }

    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            return current[key];
        }, obj);
        target[lastKey] = value;
    }

    // Notify subscribers of state change
    notifySubscribers(key, newValue, oldValue) {
        const subscribers = this.subscribers.get(key);
        if (subscribers) {
            subscribers.forEach(callback => {
                try {
                    callback(newValue, oldValue);
                } catch (error) {
                    console.error('[StateManager] Subscriber error:', error);
                }
            });
        }
    }

    // Reset state
    reset() {
        // Keep system state, reset other data
        const systemState = this.state.system;
        const devices = this.state.devices;
        
        this.state = {
            ...this.state,
            mining: {
                totalShares: 0,
                acceptedShares: 0,
                rejectedShares: 0,
                acceptanceRate: 0,
                sharesPerMinute: [],
                performanceData: []
            },
            events: [],
            charts: {
                currentChart: 'shares',
                data: {
                    shares: [],
                    acceptance: [],
                    performance: []
                }
            }
        };
        
        // Notify all subscribers
        this.notifySubscribers('*', this.state, {});
    }
}

// Global state instance
let bitmindState = null;

// Initialize state manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    bitmindState = new BitmindStateManager();
});

// Export for use in other modules
window.BitmindStateManager = BitmindStateManager;
window.bitmindState = bitmindState;
