class BitmindDashboard {
    constructor() {
        this.state = {
            blockHeight: null,
            currentJob: null,
            devices: [],
            shares: [],
            stats: {
                total: 0,
                accepted: 0,
                rejected: 0,
                acceptanceRate: 0
            },
            lastUpdate: null,
            connectionStatus: 'disconnected'
        };
        
        this.activityFeed = [];
        this.maxActivityItems = 50;
        
        this.initializeEventHandlers();
        this.fetchInitialData();
    }

    initializeEventHandlers() {
        // WebSocket event handlers
        if (window.bitmindWS) {
            window.bitmindWS.on('connected', () => {
                this.addActivity('Connected to Bitmind server', 'system');
                this.fetchInitialData();
            });
            
            window.bitmindWS.on('disconnected', () => {
                this.addActivity('Disconnected from Bitmind server', 'system');
            });
            
            window.bitmindWS.on('welcome', (data) => {
                this.addActivity('Welcome message received', 'system');
            });
            
            window.bitmindWS.on('new_job', (data) => {
                this.handleNewJob(data.job);
            });
            
            window.bitmindWS.on('block_update', (data) => {
                this.handleBlockUpdate(data);
            });
            
            window.bitmindWS.on('device_event', (data) => {
                this.handleDeviceEvent(data);
            });
        }
    }

    async fetchInitialData() {
        try {
            // Fetch current job
            const jobResponse = await fetch('http://localhost:3001/mining/job');
            if (jobResponse.ok) {
                const jobData = await jobResponse.json();
                if (jobData.status === 'ok') {
                    this.handleNewJob(jobData.job);
                }
            }
            
            // Fetch devices
            const devicesResponse = await fetch('http://localhost:3001/mining/devices');
            if (devicesResponse.ok) {
                const devicesData = await devicesResponse.json();
                if (devicesData.status === 'ok') {
                    this.updateDevices(devicesData.devices);
                }
            }
            
            // Fetch stats
            const statsResponse = await fetch('http://localhost:3001/mining/stats');
            if (statsResponse.ok) {
                const statsData = await statsResponse.json();
                if (statsData.status === 'ok') {
                    this.updateStats(statsData.stats);
                }
            }
            
        } catch (error) {
            console.error('Failed to fetch initial data:', error);
            this.addActivity('Failed to fetch initial data', 'error');
        }
    }

    handleNewJob(job) {
        this.state.currentJob = job;
        this.state.lastUpdate = new Date();
        
        // Update UI
        this.updateJobPanel();
        this.addActivity(`New job received: ${job.job_id}`, 'job');
    }

    handleBlockUpdate(data) {
        this.state.blockHeight = data.height;
        this.state.lastUpdate = new Date();
        
        // Update UI
        this.updateBlockPanel();
        this.addActivity(`Block height updated: ${data.height}`, 'block');
    }

    handleDeviceEvent(data) {
        // Refresh device list
        this.fetchDevices();
        this.addActivity(`Device event: ${data.type}`, 'device');
    }

    async fetchDevices() {
        try {
            const response = await fetch('http://localhost:3001/mining/devices');
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'ok') {
                    this.updateDevices(data.devices);
                }
            }
        } catch (error) {
            console.error('Failed to fetch devices:', error);
        }
    }

    updateDevices(devices) {
        this.state.devices = devices;
        this.updateDevicePanel();
    }

    updateStats(stats) {
        this.state.stats = {
            total: stats.shares.total,
            accepted: stats.shares.valid,
            rejected: stats.shares.invalid,
            acceptanceRate: stats.shares.acceptance_rate
        };
        this.updateStatsPanel();
    }

    updateBlockPanel() {
        const blockHeightEl = document.getElementById('blockHeight');
        const lastUpdateEl = document.getElementById('lastUpdate');
        
        if (blockHeightEl && this.state.blockHeight) {
            blockHeightEl.textContent = this.state.blockHeight.toLocaleString();
        }
        
        if (lastUpdateEl && this.state.lastUpdate) {
            lastUpdateEl.textContent = this.formatTime(this.state.lastUpdate);
        }
    }

    updateJobPanel() {
        const jobIdEl = document.getElementById('jobId');
        const jobTargetEl = document.getElementById('jobTarget');
        const prevBlockHashEl = document.getElementById('prevBlockHash');
        
        if (jobIdEl && this.state.currentJob) {
            jobIdEl.textContent = this.state.currentJob.job_id;
        }
        
        if (jobTargetEl && this.state.currentJob) {
            jobTargetEl.textContent = this.formatHash(this.state.currentJob.target);
        }
        
        if (prevBlockHashEl && this.state.currentJob) {
            prevBlockHashEl.textContent = this.formatHash(this.state.currentJob.previousblockhash);
        }
    }

    updateDevicePanel() {
        const onlineDevicesEl = document.getElementById('onlineDevices');
        const totalDevicesEl = document.getElementById('totalDevices');
        const deviceListEl = document.getElementById('deviceList');
        
        const onlineDevices = this.state.devices.filter(d => d.online).length;
        const totalDevices = this.state.devices.length;
        
        if (onlineDevicesEl) {
            onlineDevicesEl.textContent = onlineDevices;
        }
        
        if (totalDevicesEl) {
            totalDevicesEl.textContent = totalDevices;
        }
        
        if (deviceListEl) {
            if (this.state.devices.length === 0) {
                deviceListEl.innerHTML = '<div class="no-devices">No devices connected</div>';
            } else {
                deviceListEl.innerHTML = this.state.devices.map(device => `
                    <div class="device-item ${device.online ? 'online' : 'offline'}">
                        <div class="device-info">
                            <div class="device-name">${device.device_id}</div>
                            <div class="device-status">${device.online ? 'Online' : 'Offline'}</div>
                        </div>
                        <div class="device-stats">
                            <div class="device-stat">
                                <span class="stat-label">Accepted:</span>
                                <span class="stat-value accepted">${device.accepted_shares}</span>
                            </div>
                            <div class="device-stat">
                                <span class="stat-label">Rejected:</span>
                                <span class="stat-value rejected">${device.rejected_shares}</span>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }
    }

    updateStatsPanel() {
        const totalSharesEl = document.getElementById('totalShares');
        const acceptedSharesEl = document.getElementById('acceptedShares');
        const rejectedSharesEl = document.getElementById('rejectedShares');
        const acceptanceRateEl = document.getElementById('acceptanceRate');
        
        if (totalSharesEl) {
            totalSharesEl.textContent = this.state.stats.total.toLocaleString();
        }
        
        if (acceptedSharesEl) {
            acceptedSharesEl.textContent = this.state.stats.accepted.toLocaleString();
        }
        
        if (rejectedSharesEl) {
            rejectedSharesEl.textContent = this.state.stats.rejected.toLocaleString();
        }
        
        if (acceptanceRateEl) {
            acceptanceRateEl.textContent = `${this.state.stats.acceptanceRate.toFixed(1)}%`;
        }
    }

    addActivity(message, type = 'info') {
        const activity = {
            message,
            type,
            timestamp: new Date()
        };
        
        this.activityFeed.unshift(activity);
        
        // Keep only the latest items
        if (this.activityFeed.length > this.maxActivityItems) {
            this.activityFeed = this.activityFeed.slice(0, this.maxActivityItems);
        }
        
        this.updateActivityFeed();
    }

    updateActivityFeed() {
        const activityFeedEl = document.getElementById('activityFeed');
        
        if (!activityFeedEl) return;
        
        if (this.activityFeed.length === 0) {
            activityFeedEl.innerHTML = '<div class="no-activity">Waiting for activity...</div>';
        } else {
            activityFeedEl.innerHTML = this.activityFeed.map(activity => `
                <div class="activity-item ${activity.type}">
                    <div class="activity-time">${this.formatTime(activity.timestamp)}</div>
                    <div class="activity-message">${activity.message}</div>
                </div>
            `).join('');
        }
    }

    formatHash(hash) {
        if (!hash) return '--';
        return hash.substring(0, 12) + '...';
    }

    formatTime(date) {
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) {
            return 'Just now';
        } else if (diff < 3600000) {
            return `${Math.floor(diff / 60000)}m ago`;
        } else {
            return date.toLocaleTimeString();
        }
    }

    // Periodic data refresh
    startPeriodicRefresh() {
        setInterval(async () => {
            if (window.bitmindWS && window.bitmindWS.getConnectionState() === 'connected') {
                // Only refresh if WebSocket is connected
                await this.fetchDevices();
                
                const statsResponse = await fetch('http://localhost:3001/mining/stats');
                if (statsResponse.ok) {
                    const statsData = await statsResponse.json();
                    if (statsData.status === 'ok') {
                        this.updateStats(statsData.stats);
                    }
                }
            }
        }, 10000); // Refresh every 10 seconds
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new BitmindDashboard();
    
    // Start periodic refresh
    dashboard.startPeriodicRefresh();
    
    // Make dashboard available globally
    window.bitmindDashboard = dashboard;
});
