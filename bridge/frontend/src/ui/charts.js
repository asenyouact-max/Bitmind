/**
 * Bitmind v7 Charts Component
 * Real-time mining statistics visualization
 */

class BitmindCharts {
    constructor() {
        this.ready = Promise.resolve(this.initialize());
        this.chart = null;
        this.currentChartType = 'shares';
        this.updateInterval = null;
        this.maxDataPoints = 60;
    }

    async initialize() {
        console.log('[Charts] Initializing charts component...');
        
        // Setup chart canvas
        this.setupChart();
        
        // Bind events
        this.bindEvents();
        
        // Start real-time updates
        this.startRealTimeUpdates();
        
        console.log('[Charts] Charts component ready');
    }

    setupChart() {
        const canvas = document.getElementById('miningChart');
        if (!canvas) {
            console.error('[Charts] Chart canvas not found');
            return;
        }

        const ctx = canvas.getContext('2d');
        
        // Initialize Chart.js chart
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Accepted Shares',
                        data: [],
                        borderColor: '#00ff00',
                        backgroundColor: 'rgba(0, 255, 0, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Rejected Shares',
                        data: [],
                        borderColor: '#ff3333',
                        backgroundColor: 'rgba(255, 51, 51, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 300
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            borderColor: 'rgba(255, 255, 255, 0.2)'
                        },
                        ticks: {
                            color: '#888',
                            font: {
                                family: 'monospace'
                            }
                        }
                    },
                    y: {
                        display: true,
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            borderColor: 'rgba(255, 255, 255, 0.2)'
                        },
                        ticks: {
                            color: '#888',
                            font: {
                                family: 'monospace'
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#00ff00',
                        bodyColor: '#fff',
                        borderColor: '#00ff00',
                        borderWidth: 1,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y}`;
                            }
                        }
                    }
                }
            }
        });
    }

    bindEvents() {
        // Chart type switcher
        document.querySelectorAll('.chart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chartType = e.target.dataset.chart;
                this.switchChart(chartType);
            });
        });

        // Window resize handler
        window.addEventListener('resize', () => {
            if (this.chart) {
                this.chart.resize();
            }
        });
    }

    switchChart(chartType) {
        this.currentChartType = chartType;
        
        // Update button states
        document.querySelectorAll('.chart-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-chart="${chartType}"]`).classList.add('active');

        // Update chart configuration based on type
        switch (chartType) {
            case 'shares':
                this.setupSharesChart();
                break;
            case 'acceptance':
                this.setupAcceptanceChart();
                break;
            case 'performance':
                this.setupPerformanceChart();
                break;
        }

        // Trigger chart update animation
        this.animateChartSwitch();
    }

    setupSharesChart() {
        if (!this.chart) return;

        this.chart.config.type = 'line';
        this.chart.data.datasets = [
            {
                label: 'Accepted Shares',
                data: [],
                borderColor: '#00ff00',
                backgroundColor: 'rgba(0, 255, 0, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            },
            {
                label: 'Rejected Shares',
                data: [],
                borderColor: '#ff3333',
                backgroundColor: 'rgba(255, 51, 51, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }
        ];

        this.chart.options.scales.y.beginAtZero = true;
        this.chart.update();
    }

    setupAcceptanceChart() {
        if (!this.chart) return;

        this.chart.config.type = 'doughnut';
        this.chart.data.datasets = [
            {
                data: [0, 0],
                backgroundColor: ['#00ff00', '#ff3333'],
                borderColor: '#000',
                borderWidth: 2
            }
        ];

        this.chart.data.labels = ['Accepted', 'Rejected'];
        this.chart.options.scales = {};
        this.chart.update();
    }

    setupPerformanceChart() {
        if (!this.chart) return;

        this.chart.config.type = 'bar';
        this.chart.data.datasets = [
            {
                label: 'Shares per Minute',
                data: [],
                backgroundColor: 'rgba(0, 255, 0, 0.6)',
                borderColor: '#00ff00',
                borderWidth: 2
            }
        ];

        this.chart.options.scales.y.beginAtZero = true;
        this.chart.update();
    }

    animateChartSwitch() {
        const chartContainer = document.querySelector('.chart-container');
        if (chartContainer) {
            chartContainer.classList.add('switching');
            setTimeout(() => {
                chartContainer.classList.remove('switching');
            }, 300);
        }
    }

    updateData(miningStats) {
        if (!this.chart) return;

        switch (this.currentChartType) {
            case 'shares':
                this.updateSharesChart(miningStats);
                break;
            case 'acceptance':
                this.updateAcceptanceChart(miningStats);
                break;
            case 'performance':
                this.updatePerformanceChart(miningStats);
                break;
        }
    }

    updateSharesChart(miningStats) {
        const now = new Date();
        const timeLabel = now.toLocaleTimeString();
        
        // Add new data point
        this.chart.data.labels.push(timeLabel);
        this.chart.data.datasets[0].data.push(miningStats.acceptedShares || 0);
        this.chart.data.datasets[1].data.push(miningStats.rejectedShares || 0);
        
        // Keep only recent data points
        if (this.chart.data.labels.length > this.maxDataPoints) {
            this.chart.data.labels.shift();
            this.chart.data.datasets[0].data.shift();
            this.chart.data.datasets[1].data.shift();
        }
        
        this.chart.update('none'); // Update without animation for real-time feel
    }

    updateAcceptanceChart(miningStats) {
        const total = miningStats.acceptedShares + miningStats.rejectedShares;
        const accepted = miningStats.acceptedShares;
        const rejected = miningStats.rejectedShares;
        
        this.chart.data.datasets[0].data = [accepted, rejected];
        this.chart.update('none');
    }

    updatePerformanceChart(miningStats) {
        // Calculate shares per minute
        const now = new Date();
        const timeLabel = now.toLocaleTimeString();
        const sharesPerMinute = (miningStats.acceptedShares + miningStats.rejectedShares) || 0;
        
        this.chart.data.labels.push(timeLabel);
        this.chart.data.datasets[0].data.push(sharesPerMinute);
        
        // Keep only recent data points
        if (this.chart.data.labels.length > this.maxDataPoints) {
            this.chart.data.labels.shift();
            this.chart.data.datasets[0].data.shift();
        }
        
        this.chart.update('none');
    }

    addDataPoint(data) {
        if (!this.chart) return;

        const now = new Date();
        const timeLabel = now.toLocaleTimeString();
        
        this.chart.data.labels.push(timeLabel);
        
        // Add data based on current chart type
        switch (this.currentChartType) {
            case 'shares':
                this.chart.data.datasets[0].data.push(data.accepted || 0);
                this.chart.data.datasets[1].data.push(data.rejected || 0);
                break;
            case 'performance':
                this.chart.data.datasets[0].data.push(data.value || 0);
                break;
        }
        
        // Keep only recent data points
        if (this.chart.data.labels.length > this.maxDataPoints) {
            this.chart.data.labels.shift();
            this.chart.data.datasets.forEach(dataset => {
                dataset.data.shift();
            });
        }
        
        this.chart.update('none');
    }

    startRealTimeUpdates() {
        // Update chart every 5 seconds
        this.updateInterval = setInterval(() => {
            this.fetchLatestData();
        }, 5000);
    }

    async fetchLatestData() {
        try {
            const response = await fetch('http://localhost:3001/monitoring/metrics/summary');
            if (response.ok) {
                const data = await response.json();
                this.updateData(data.summary.mining);
            }
        } catch (error) {
            console.error('[Charts] Failed to fetch latest data:', error);
        }
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        if (this.chart) {
            this.chart.destroy();
        }
    }

    // Export chart as image
    exportChart() {
        if (!this.chart) return;
        
        const canvas = document.getElementById('miningChart');
        const url = canvas.toDataURL('image/png');
        
        // Create download link
        const link = document.createElement('a');
        link.download = `bitmind-chart-${this.currentChartType}-${Date.now()}.png`;
        link.href = url;
        link.click();
    }

    // Reset chart data
    reset() {
        if (!this.chart) return;
        
        this.chart.data.labels = [];
        this.chart.data.datasets.forEach(dataset => {
            dataset.data = [];
        });
        this.chart.update();
    }
}

// Export for use in main app
window.BitmindCharts = BitmindCharts;
