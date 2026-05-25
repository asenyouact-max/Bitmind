/**
 * Bitmind v7 Main Application
 * Mining Control Room UI - Real-time visualization system
 */

// Import modules
import './ui/dashboard.js';
import './ui/charts.js';
import './ui/devices.js';
import './ui/activityFeed.js';
import './ui/animations.js';
import './ui/connectMiner.js';
import './ui/buyBitminer.js';

class BitmindApp {
    constructor() {
        this.isInitialized = false;
        this.components = {};
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    async initialize() {
        if (this.isInitialized) return;
        
        try {
            console.log('[BitmindApp] Initializing Mining Control Room...');
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }
            
            // Small delay to ensure all elements are loaded
            await new Promise(resolve => setTimeout(resolve, 200));
            
            console.log('[BitmindApp] DOM ready, initializing components...');
            
            // Initialize components
            await this.initializeComponents();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Fetch initial data
            await this.fetchInitialData();
            
            // Start periodic updates
            this.startPeriodicUpdates();
            
            this.isInitialized = true;
            console.log('[BitmindApp] Mining Control Room ready');
            
        } catch (error) {
            console.error('[BitmindApp] Failed to initialize:', error);
            this.showError('Failed to initialize Mining Control Room');
        }
    }

    async initializeComponents() {
        // Initialize UI components
        this.components.dashboard = new BitmindDashboard();
        this.components.charts = new BitmindCharts();
        this.components.devices = new BitmindDeviceNetwork();
        this.components.activityFeed = new BitmindActivityFeed();
        this.components.animations = new BitmindAnimations();
        this.components.connectMiner = new BitmindConnectMiner();
        this.components.buyBitminer = new BitmindBuyBitminer();
        
        // Wait for components to be ready
        await Promise.all(Object.values(this.components).map(component => {
            return component.ready || Promise.resolve();
        }));
    }

    setupEventListeners() {
        // WebSocket event handlers
        if (window.bitmindWS) {
            window.bitmindWS.on('connected', () => {
                console.log('[BitmindApp] WebSocket connected');
                this.updateConnectionStatus('Connected', 'connected');
            });
            
            window.bitmindWS.on('disconnected', () => {
                console.log('[BitmindApp] WebSocket disconnected');
                this.updateConnectionStatus('Disconnected', 'disconnected');
            });
            
            window.bitmindWS.on('new_job', (data) => {
                console.log('[BitmindApp] New job received:', data);
                this.handleNewJob(data);
            });
            
            window.bitmindWS.on('block_update', (data) => {
                console.log('[BitmindApp] Block update:', data);
                this.handleBlockUpdate(data);
            });
            
            window.bitmindWS.on('device_event', (data) => {
                console.log('[BitmindApp] Device event:', data);
                this.handleDeviceEvent(data);
            });
        }
        
        // State change handlers
        if (window.bitmindState) {
            window.bitmindState.subscribe('system', (system) => {
                this.updateSystemOverview(system);
            });
            
            window.bitmindState.subscribe('job', (job) => {
                this.updateJobPanel(job);
            });
            
            window.bitmindState.subscribe('deviceStats', (stats) => {
                this.updateDeviceStats(stats);
            });
            
            window.bitmindState.subscribe('mining', (mining) => {
                this.updateMiningStats(mining);
            });
            
            window.bitmindState.subscribe('events', (events) => {
                this.components.activityFeed?.updateEvents(events);
            });
        }
        
        // UI event handlers
        this.setupUIEventListeners();
    }

    setupUIEventListeners() {
        // Chart controls
        document.querySelectorAll('.chart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chartType = e.target.dataset.chart;
                this.switchChart(chartType);
            });
        });
        
        // Feed filters
        document.querySelectorAll('.feed-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                this.filterEvents(filter);
            });
        });
        
        // Health indicator click
        const healthIndicator = document.getElementById('systemHealth');
        if (healthIndicator) {
            healthIndicator.addEventListener('click', () => {
                this.showHealthDetails();
            });
        }
    }

    async fetchInitialData() {
        try {
            // Fetch current system state
            const [overviewResponse, jobResponse, devicesResponse] = await Promise.all([
                fetch('http://localhost:3001/monitoring/stats/overview'),
                fetch('http://localhost:3001/mining/job'),
                fetch('http://localhost:3001/mining/devices')
            ]);
            
            // Update state with fetched data
            if (overviewResponse.ok) {
                const overview = await overviewResponse.json();
                this.updateSystemOverview(overview.overview.system);
                this.updateMiningStats(overview.overview.mining);
            }
            
            if (jobResponse.ok) {
                const jobData = await jobResponse.json();
                this.updateJobPanel(jobData.job);
            }
            
            if (devicesResponse.ok) {
                const devicesData = await devicesResponse.json();
                this.updateDeviceStats({
                    online: devicesData.devices.filter(d => d.online).length,
                    total: devicesData.devices.length
                });
            }
            
        } catch (error) {
            console.error('[BitmindApp] Failed to fetch initial data:', error);
        }
    }

    startPeriodicUpdates() {
        // Update system metrics every 10 seconds
        setInterval(async () => {
            if (window.bitmindWS?.getConnectionState() === 'connected') {
                try {
                    const response = await fetch('http://localhost:3001/monitoring/stats/overview');
                    if (response.ok) {
                        const overview = await response.json();
                        this.updateSystemOverview(overview.overview.system);
                        this.updateMiningStats(overview.overview.mining);
                    }
                } catch (error) {
                    console.error('[BitmindApp] Failed to update metrics:', error);
                }
            }
        }, 10000);
    }

    handleNewJob(jobData) {
        if (window.bitmindState) {
            window.bitmindState.handleNewJob(jobData);
        }
        
        // Trigger animations
        this.components.animations?.trigger('jobUpdate');
    }

    handleBlockUpdate(blockData) {
        if (window.bitmindState) {
            window.bitmindState.handleBlockUpdate(blockData);
        }
        
        // Trigger animations
        this.components.animations?.trigger('blockUpdate');
    }

    handleDeviceEvent(deviceData) {
        if (window.bitmindState) {
            window.bitmindState.handleDeviceEvent(deviceData);
        }
        
        // Update device visualization
        this.components.devices?.updateDevice(deviceData);
    }

    updateConnectionStatus(text, status) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            const statusDot = statusElement.querySelector('.status-dot');
            const statusText = statusElement.querySelector('.status-text');
            
            statusText.textContent = text;
            statusDot.className = `status-dot ${status}`;
        }
    }

    updateSystemOverview(system) {
        // Update block height
        const blockHeightEl = document.getElementById('blockHeight');
        if (blockHeightEl && system.blockHeight) {
            blockHeightEl.textContent = system.blockHeight.toLocaleString();
        }
        
        // Update uptime
        const uptimeEl = document.getElementById('systemUptime');
        if (uptimeEl && system.uptime) {
            uptimeEl.textContent = this.formatUptime(system.uptime);
        }
        
        // Update device count
        const devicesOnlineEl = document.getElementById('devicesOnline');
        if (devicesOnlineEl) {
            devicesOnlineEl.textContent = system.activeDevices || 0;
        }
        
        // Update health indicator
        this.updateHealthIndicator(system.status);
    }

    updateJobPanel(job) {
        // Update job details
        const jobIdEl = document.getElementById('jobId');
        if (jobIdEl && job.job_id) {
            jobIdEl.textContent = job.job_id;
        }
        
        const targetEl = document.getElementById('jobTarget');
        if (targetEl && job.target) {
            targetEl.textContent = this.formatHash(job.target);
        }
        
        const prevBlockEl = document.getElementById('prevBlockHash');
        if (prevBlockEl && job.previousblockhash) {
            prevBlockEl.textContent = this.formatHash(job.previousblockhash);
        }
        
        const lastUpdateEl = document.getElementById('lastUpdate');
        if (lastUpdateEl) {
            lastUpdateEl.textContent = job.lastUpdate ? this.formatTime(job.lastUpdate) : 'Just now';
        }
    }

    updateDeviceStats(stats) {
        // Update device counts
        const onlineCountEl = document.getElementById('onlineCount');
        const totalCountEl = document.getElementById('totalCount');
        
        if (onlineCountEl) {
            onlineCountEl.textContent = stats.online;
        }
        
        if (totalCountEl) {
            totalCountEl.textContent = stats.total;
        }
    }

    updateMiningStats(mining) {
        // Update mining statistics
        const acceptedCountEl = document.getElementById('acceptedCount');
        const rejectedCountEl = document.getElementById('rejectedCount');
        
        if (acceptedCountEl) {
            acceptedCountEl.textContent = mining.sharesAccepted || 0;
        }
        
        if (rejectedCountEl) {
            rejectedCountEl.textContent = mining.sharesRejected || 0;
        }
        
        // Update charts
        this.components.charts?.updateData(mining);
    }

    updateHealthIndicator(status) {
        const healthIndicator = document.getElementById('systemHealth');
        if (healthIndicator) {
            const healthDot = healthIndicator.querySelector('.health-dot');
            const healthText = healthIndicator.querySelector('.health-text');
            
            healthText.textContent = status.toUpperCase();
            healthDot.className = `health-dot ${status}`;
        }
    }

    switchChart(chartType) {
        // Update button states
        document.querySelectorAll('.chart-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-chart="${chartType}"]`).classList.add('active');
        
        // Update chart
        this.components.charts?.switchChart(chartType);
        
        // Update state
        if (window.bitmindState) {
            window.bitmindState.setState('charts.currentChart', chartType);
        }
    }

    filterEvents(filter) {
        // Update button states
        document.querySelectorAll('.feed-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        // Update event feed
        this.components.activityFeed?.setFilter(filter);
        
        // Update state
        if (window.bitmindState) {
            Object.keys(window.bitmindState.state.eventFilters).forEach(key => {
                window.bitmindState.setState(`eventFilters.${key}`, key === filter);
            });
        }
    }

    showHealthDetails() {
        // This could open a modal with detailed health information
        console.log('[BitmindApp] Health details requested');
        // Implementation would go here
    }

    formatHash(hash) {
        if (!hash) return '--';
        return hash.substring(0, 12) + '...';
    }

    formatTime(date) {
        const now = new Date();
        const diff = now - new Date(date);
        
        if (diff < 60000) {
            return 'Just now';
        } else if (diff < 3600000) {
            return `${Math.floor(diff / 60000)}m ago`;
        } else {
            return new Date(date).toLocaleTimeString();
        }
    }

    formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        return `${hours}h ${minutes}m ${secs}s`;
    }

    showError(message) {
        // Show error message in UI
        console.error('[BitmindApp] Error:', message);
        // Implementation would go here
    }
}

// Initialize the application
const bitmindApp = new BitmindApp();

// Export for global access
window.BitmindApp = BitmindApp;
window.bitmindApp = bitmindApp;
