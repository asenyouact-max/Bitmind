/**
 * Bitmind v7 Activity Feed Component
 * Real-time event stream with animations
 */

class BitmindActivityFeed {
    constructor() {
        this.ready = Promise.resolve(this.initialize());
        this.events = [];
        this.maxEvents = 50;
        this.currentFilter = 'all';
        this.eventStream = null;
        this.autoScroll = true;
    }

    async initialize() {
        console.log('[ActivityFeed] Initializing activity feed component...');
        
        // Setup event stream
        this.setupEventStream();
        
        // Bind events
        this.bindEvents();
        
        console.log('[ActivityFeed] Activity feed component ready');
    }

    setupEventStream() {
        this.eventStream = document.getElementById('eventStream');
        if (!this.eventStream) {
            console.error('[ActivityFeed] Event stream not found');
            return;
        }
    }

    bindEvents() {
        // Filter buttons
        document.querySelectorAll('.feed-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                this.setFilter(filter);
            });
        });

        // Auto-scroll toggle
        this.eventStream.addEventListener('scroll', () => {
            const isAtBottom = this.eventStream.scrollHeight - this.eventStream.scrollTop === this.eventStream.clientHeight;
            this.autoScroll = isAtBottom;
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target === this.eventStream) {
                this.handleKeyboardShortcuts(e);
            }
        });
    }

    handleKeyboardShortcuts(e) {
        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                this.navigateEvents(-1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.navigateEvents(1);
                break;
            case 'Home':
                e.preventDefault();
                this.scrollToTop();
                break;
            case 'End':
                e.preventDefault();
                this.scrollToBottom();
                break;
        }
    }

    navigateEvents(direction) {
        const events = this.eventStream.querySelectorAll('.event-item');
        if (events.length === 0) return;

        const currentIndex = Array.from(events).findIndex(event => event.classList.contains('selected'));
        let newIndex = currentIndex + direction;

        // Wrap around
        if (newIndex < 0) newIndex = events.length - 1;
        if (newIndex >= events.length) newIndex = 0;

        // Remove previous selection
        events.forEach(event => event.classList.remove('selected'));

        // Add new selection
        events[newIndex].classList.add('selected');
        events[newIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    scrollToTop() {
        this.eventStream.scrollTop = 0;
        this.autoScroll = false;
    }

    scrollToBottom() {
        this.eventStream.scrollTop = this.eventStream.scrollHeight;
        this.autoScroll = true;
    }

    addEvent(event) {
        // Add to events array
        this.events.unshift(event);
        
        // Keep only recent events
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(0, this.maxEvents);
        }
        
        // Update UI
        this.renderEvent(event);
        this.cleanupOldEvents();
    }

    renderEvent(event) {
        const eventEl = this.createEventElement(event);
        
        // Add to top of stream
        if (this.eventStream.firstChild && this.eventStream.firstChild.classList.contains('no-events')) {
            this.eventStream.innerHTML = '';
        }
        
        this.eventStream.insertBefore(eventEl, this.eventStream.firstChild);
        
        // Apply filter
        if (!this.shouldShowEvent(event)) {
            eventEl.style.display = 'none';
        }
        
        // Auto-scroll if enabled
        if (this.autoScroll) {
            this.scrollToBottom();
        }
        
        // Trigger entrance animation
        setTimeout(() => {
            eventEl.classList.add('visible');
        }, 10);
    }

    createEventElement(event) {
        const eventEl = document.createElement('div');
        eventEl.className = `event-item ${event.type} visible`;
        eventEl.dataset.eventType = event.type;
        eventEl.dataset.timestamp = event.timestamp.getTime();
        
        const timeAgo = this.getTimeAgo(event.timestamp);
        const icon = this.getEventIcon(event.type);
        const color = this.getEventColor(event.type);
        
        eventEl.innerHTML = `
            <div class="event-header">
                <div class="event-icon" style="color: ${color}">${icon}</div>
                <div class="event-time">${timeAgo}</div>
            </div>
            <div class="event-content">
                <div class="event-message">${event.message}</div>
                ${event.data ? this.createEventDetails(event) : ''}
            </div>
            <div class="event-pulse"></div>
        `;
        
        return eventEl;
    }

    createEventDetails(event) {
        if (event.type === 'share') {
            return `
                <div class="event-details">
                    <div class="detail-item">
                        <span class="detail-label">Device:</span>
                        <span class="detail-value">${event.data.device_id}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Nonce:</span>
                        <span class="detail-value">${event.data.nonce}</span>
                    </div>
                </div>
            `;
        } else if (event.type === 'job') {
            return `
                <div class="event-details">
                    <div class="detail-item">
                        <span class="detail-label">Job ID:</span>
                        <span class="detail-value">${event.data.job_id}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Height:</span>
                        <span class="detail-value">${event.data.height}</span>
                    </div>
                </div>
            `;
        } else if (event.type === 'block') {
            return `
                <div class="event-details">
                    <div class="detail-item">
                        <span class="detail-label">Height:</span>
                        <span class="detail-value">${event.data.height}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Previous:</span>
                        <span class="detail-value">${event.data.previous_height || 'N/A'}</span>
                    </div>
                </div>
            `;
        }
        
        return '';
    }

    getEventIcon(type) {
        const icons = {
            share: '⛏️',
            job: '🎯',
            block: '📦',
            device: '📡',
            system: '🧠',
            error: '⚠️',
            warning: '⚡'
        };
        
        return icons[type] || '📄';
    }

    getEventColor(type) {
        const colors = {
            share: '#00ff00',
            job: '#00aaff',
            block: '#ff6b00',
            device: '#ff00ff',
            system: '#ffaa00',
            error: '#ff3333',
            warning: '#ffaa00'
        };
        
        return colors[type] || '#888';
    }

    getTimeAgo(timestamp) {
        const now = new Date();
        const diff = now - timestamp;
        
        if (diff < 1000) {
            return 'Just now';
        } else if (diff < 60000) {
            return `${Math.floor(diff / 1000)}s ago`;
        } else if (diff < 3600000) {
            return `${Math.floor(diff / 60000)}m ago`;
        } else {
            return timestamp.toLocaleTimeString();
        }
    }

    shouldShowEvent(event) {
        if (this.currentFilter === 'all') {
            return true;
        }
        
        const filterMap = {
            shares: ['share'],
            jobs: ['job'],
            devices: ['device']
        };
        
        const allowedTypes = filterMap[this.currentFilter] || [];
        return allowedTypes.includes(event.type);
    }

    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update button states
        document.querySelectorAll('.feed-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        // Filter existing events
        this.filterEvents();
    }

    filterEvents() {
        const eventItems = this.eventStream.querySelectorAll('.event-item');
        
        eventItems.forEach(eventEl => {
            const eventType = eventEl.dataset.eventType;
            const shouldShow = this.shouldShowEvent({ type: eventType });
            
            if (shouldShow) {
                eventEl.style.display = '';
            } else {
                eventEl.style.display = 'none';
            }
        });
    }

    updateEvents(events) {
        // Clear current events
        this.eventStream.innerHTML = '';
        
        // Render all events
        events.forEach(event => {
            this.renderEvent(event);
        });
        
        // Apply current filter
        this.filterEvents();
        
        // Auto-scroll to bottom
        if (this.autoScroll) {
            this.scrollToBottom();
        }
    }

    cleanupOldEvents() {
        const eventItems = this.eventStream.querySelectorAll('.event-item');
        
        // Keep only recent events
        if (eventItems.length > this.maxEvents) {
            for (let i = this.maxEvents; i < eventItems.length; i++) {
                eventItems[i].classList.add('removing');
                setTimeout(() => {
                    eventItems[i].remove();
                }, 300);
            }
        }
    }

    clear() {
        this.events = [];
        this.eventStream.innerHTML = '<div class="no-events">WAITING FOR MINING ACTIVITY...</div>';
    }

    // Search events
    searchEvents(query) {
        const eventItems = this.eventStream.querySelectorAll('.event-item');
        const lowerQuery = query.toLowerCase();
        
        eventItems.forEach(eventEl => {
            const message = eventEl.querySelector('.event-message').textContent.toLowerCase();
            const matches = message.includes(lowerQuery);
            
            if (matches) {
                eventEl.style.display = '';
                eventEl.classList.add('highlighted');
            } else {
                eventEl.style.display = 'none';
                eventEl.classList.remove('highlighted');
            }
        });
        
        // Clear highlights after 2 seconds
        setTimeout(() => {
            eventItems.forEach(eventEl => {
                eventEl.classList.remove('highlighted');
            });
        }, 2000);
    }

    // Export events
    exportEvents() {
        const data = this.events.map(event => ({
            timestamp: event.timestamp.toISOString(),
            type: event.type,
            message: event.message,
            data: event.data
        }));
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.download = `bitmind-events-${Date.now()}.json`;
        link.href = url;
        link.click();
        
        URL.revokeObjectURL(url);
    }

    // Get event statistics
    getEventStats() {
        const stats = {
            total: this.events.length,
            byType: {},
            recent: 0
        };
        
        const oneHourAgo = new Date(Date.now() - 3600000);
        
        this.events.forEach(event => {
            // Count by type
            stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
            
            // Count recent events
            if (event.timestamp > oneHourAgo) {
                stats.recent++;
            }
        });
        
        return stats;
    }
}

// Export for use in main app
window.BitmindActivityFeed = BitmindActivityFeed;
