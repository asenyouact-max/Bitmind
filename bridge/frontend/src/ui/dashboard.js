/**
 * Bitmind v7 Dashboard Component
 * Main dashboard controller for the mining control room
 */

class BitmindDashboard {
    constructor() {
        this.ready = Promise.resolve(this.initialize());
    }

    async initialize() {
        console.log('[Dashboard] Initializing dashboard component...');
        
        // Setup dashboard elements
        this.setupElements();
        
        // Bind event handlers
        this.bindEvents();
        
        console.log('[Dashboard] Dashboard component ready');
    }

    setupElements() {
        // Cache frequently used elements
        this.elements = {
            systemOverview: document.querySelector('.system-overview'),
            miningJob: document.querySelector('.mining-job'),
            deviceNetwork: document.querySelector('.device-network'),
            chartsPanel: document.querySelector('.charts-panel'),
            eventFeed: document.querySelector('.event-feed'),
            
            // Status indicators
            connectionStatus: document.getElementById('connectionStatus'),
            systemHealth: document.getElementById('systemHealth'),
            jobStatus: document.getElementById('jobStatus'),
            
            // Metric displays
            blockHeight: document.getElementById('blockHeight'),
            systemUptime: document.getElementById('systemUptime'),
            devicesOnline: document.getElementById('devicesOnline'),
            
            // Job details
            jobId: document.getElementById('jobId'),
            jobTarget: document.getElementById('jobTarget'),
            prevBlockHash: document.getElementById('prevBlockHash'),
            lastUpdate: document.getElementById('lastUpdate')
        };
    }

    bindEvents() {
        // Panel hover effects
        document.querySelectorAll('.panel').forEach(panel => {
            panel.addEventListener('mouseenter', () => {
                panel.classList.add('panel-hover');
            });
            
            panel.addEventListener('mouseleave', () => {
                panel.classList.remove('panel-hover');
            });
        });

        // Panel click to focus
        document.querySelectorAll('.panel').forEach(panel => {
            panel.addEventListener('click', () => {
                this.focusPanel(panel);
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }

    focusPanel(panel) {
        // Remove focus from all panels
        document.querySelectorAll('.panel').forEach(p => {
            p.classList.remove('focused');
        });
        
        // Add focus to clicked panel
        panel.classList.add('focused');
        
        // Scroll panel into view if needed
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + 1-5 to focus panels
        if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '5') {
            e.preventDefault();
            const panelIndex = parseInt(e.key) - 1;
            const panels = document.querySelectorAll('.panel');
            if (panels[panelIndex]) {
                this.focusPanel(panels[panelIndex]);
            }
        }
        
        // Escape to unfocus
        if (e.key === 'Escape') {
            document.querySelectorAll('.panel').forEach(p => {
                p.classList.remove('focused');
            });
        }
    }

    updateSystemOverview(system) {
        if (!this.elements.systemOverview) return;

        // Animate block height update
        if (system.blockHeight && this.elements.blockHeight) {
            this.animateValue(this.elements.blockHeight, system.blockHeight);
        }

        // Update uptime with animation
        if (system.uptime && this.elements.systemUptime) {
            this.elements.systemUptime.textContent = this.formatUptime(system.uptime);
        }

        // Update device count
        if (system.activeDevices !== undefined && this.elements.devicesOnline) {
            this.animateValue(this.elements.devicesOnline, system.activeDevices);
        }

        // Update health indicator
        this.updateHealthIndicator(system.status);
    }

    updateMiningJob(job) {
        if (!this.elements.miningJob) return;

        // Animate job ID update
        if (job.job_id && this.elements.jobId) {
            this.elements.jobId.classList.add('updating');
            this.elements.jobId.textContent = job.job_id;
            setTimeout(() => {
                this.elements.jobId.classList.remove('updating');
            }, 500);
        }

        // Update other job fields
        if (job.target && this.elements.jobTarget) {
            this.elements.jobTarget.textContent = this.formatHash(job.target);
        }

        if (job.previousblockhash && this.elements.prevBlockHash) {
            this.elements.prevBlockHash.textContent = this.formatHash(job.previousblockhash);
        }

        if (job.lastUpdate && this.elements.lastUpdate) {
            this.elements.lastUpdate.textContent = this.formatTime(job.lastUpdate);
        }

        // Trigger job pulse animation
        if (this.elements.jobStatus) {
            this.elements.jobStatus.classList.add('pulse');
            setTimeout(() => {
                this.elements.jobStatus.classList.remove('pulse');
            }, 1000);
        }
    }

    updateDeviceStats(stats) {
        // Update device network visualization
        const onlineCount = document.getElementById('onlineCount');
        const totalCount = document.getElementById('totalCount');
        
        if (onlineCount) {
            this.animateValue(onlineCount, stats.online);
        }
        
        if (totalCount) {
            this.animateValue(totalCount, stats.total);
        }
    }

    updateConnectionStatus(status, state) {
        if (!this.elements.connectionStatus) return;

        const statusDot = this.elements.connectionStatus.querySelector('.status-dot');
        const statusText = this.elements.connectionStatus.querySelector('.status-text');
        
        statusText.textContent = status;
        statusDot.className = `status-dot ${state}`;
        
        // Add connection animation
        if (state === 'connected') {
            this.elements.connectionStatus.classList.add('connected');
            setTimeout(() => {
                this.elements.connectionStatus.classList.remove('connected');
            }, 1000);
        }
    }

    updateHealthIndicator(status) {
        if (!this.elements.systemHealth) return;

        const healthDot = this.elements.systemHealth.querySelector('.health-dot');
        const healthText = this.elements.systemHealth.querySelector('.health-text');
        
        healthText.textContent = status.toUpperCase();
        healthDot.className = `health-dot ${status}`;
        
        // Add health pulse for critical status
        if (status === 'critical') {
            this.elements.systemHealth.classList.add('critical');
        } else {
            this.elements.systemHealth.classList.remove('critical');
        }
    }

    animateValue(element, value) {
        const current = parseInt(element.textContent) || 0;
        const target = parseInt(value) || 0;
        const duration = 500;
        const steps = 20;
        const increment = (target - current) / steps;
        let step = 0;
        
        const timer = setInterval(() => {
            step++;
            const newValue = Math.round(current + (increment * step));
            element.textContent = newValue.toLocaleString();
            
            if (step >= steps) {
                clearInterval(timer);
                element.textContent = target.toLocaleString();
            }
        }, duration / steps);
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

    // Show loading state
    showLoading(panel) {
        const loadingEl = panel.querySelector('.loading') || this.createLoadingElement();
        panel.appendChild(loadingEl);
        panel.classList.add('loading');
    }

    // Hide loading state
    hideLoading(panel) {
        const loadingEl = panel.querySelector('.loading');
        if (loadingEl) {
            loadingEl.remove();
        }
        panel.classList.remove('loading');
    }

    createLoadingElement() {
        const loading = document.createElement('div');
        loading.className = 'loading';
        loading.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading...</div>
        `;
        return loading;
    }

    // Show error state
    showError(panel, message) {
        const errorEl = panel.querySelector('.error') || this.createErrorElement(message);
        panel.appendChild(errorEl);
        panel.classList.add('error');
    }

    // Hide error state
    hideError(panel) {
        const errorEl = panel.querySelector('.error');
        if (errorEl) {
            errorEl.remove();
        }
        panel.classList.remove('error');
    }

    createErrorElement(message) {
        const error = document.createElement('div');
        error.className = 'error';
        error.innerHTML = `
            <div class="error-icon">⚠️</div>
            <div class="error-message">${message}</div>
        `;
        return error;
    }

    // Refresh dashboard data
    async refresh() {
        try {
            // Show loading on all panels
            document.querySelectorAll('.panel').forEach(panel => {
                this.showLoading(panel);
            });

            // Fetch fresh data
            const response = await fetch('http://localhost:3001/monitoring/stats/overview');
            const data = await response.json();

            // Update all panels
            this.updateSystemOverview(data.overview.system);
            this.updateMiningJob(data.overview.mining.currentJob);
            this.updateDeviceStats(data.overview.devices);

        } catch (error) {
            console.error('[Dashboard] Failed to refresh:', error);
            document.querySelectorAll('.panel').forEach(panel => {
                this.showError(panel, 'Failed to load data');
            });
        } finally {
            // Hide loading states
            setTimeout(() => {
                document.querySelectorAll('.panel').forEach(panel => {
                    this.hideLoading(panel);
                    this.hideError(panel);
                });
            }, 1000);
        }
    }
}

// Export for use in main app
window.BitmindDashboard = BitmindDashboard;
