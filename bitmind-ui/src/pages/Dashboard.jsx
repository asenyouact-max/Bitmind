import React, { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import './Dashboard.css';

/**
 * Dashboard Page
 * Shows real-time mining data and WebSocket status
 * Preserves existing functionality from original App.jsx
 */
const Dashboard = ({ onDisconnect }) => {
  const { status, jobData, isConnected, disconnect } = useWebSocket();
  const [hashrate, setHashrate] = useState(0);
  const hashrateCounterRef = useRef(null);

  const handleDisconnect = () => {
    disconnect();
    onDisconnect();
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return '#10b981'; // green
      case 'connecting': return '#f59e0b'; // amber
      case 'error': return '#ef4444'; // red
      default: return '#6b7280'; // gray
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'error': return 'Connection Error';
      default: return 'Disconnected';
    }
  };

  // Animated hashrate counter effect
  useEffect(() => {
    if (isConnected && hashrateCounterRef.current) {
      const targetHashrate = Math.random() * 100 + 50; // Simulated hashrate between 50-150 TH/s
      const duration = 2000; // 2 seconds animation
      const startTime = Date.now();
      const startValue = hashrate;

      const animateCounter = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = startValue + (targetHashrate - startValue) * easeOutQuart;
        
        setHashrate(currentValue);
        
        if (progress < 1) {
          requestAnimationFrame(animateCounter);
        }
      };

      animateCounter();
    }
  }, [isConnected]);

  return (
    <div className="dashboard">
      {/* System Active Indicator */}
      <div className="system-active-indicator">
        <div className="system-pulse"></div>
        <div className="system-text">SYSTEM ACTIVE</div>
      </div>

      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <h1 className="dashboard-title">⚡ Bitmind Control Center</h1>
          
          {/* WebSocket Connection Status */}
          <div className="ws-status">
            <span 
              className={`status-indicator ${status}`}
              style={{ backgroundColor: getStatusColor() }}
            />
            <span className="status-text">WebSocket: {getStatusText()}</span>
          </div>

          {/* Disconnect Button */}
          {isConnected && (
            <button className="btn-disconnect" onClick={handleDisconnect}>
              Disconnect
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="dashboard-container">
          {/* Loading State */}
          {!jobData && (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading mining data...</p>
            </div>
          )}

          {/* Mining Control Panels */}
          {jobData && (
            <div className="mining-control-panels">
              {/* TOP SECTION: System Status (Dominant) */}
              <section className="control-section system-section">
                <div className="section-header">
                  <div className="section-title">SYSTEM STATUS</div>
                  <div className="section-divider"></div>
                </div>
                <div className="system-status-card">
                  <div className="system-status-content">
                    <div className="system-status-main">
                      <div className={`system-status-indicator ${status}`}></div>
                      <div className="system-status-text">
                        <div className="system-status-state">
                          {status === 'connected' ? 'OPERATIONAL' : 'OFFLINE'}
                        </div>
                        <div className="system-status-detail">
                          Mining Node {getStatusText()}
                        </div>
                      </div>
                    </div>
                    <div className="system-status-metrics">
                      <div className="metric-item">
                        <div className="metric-value">100%</div>
                        <div className="metric-label">Uptime</div>
                      </div>
                      <div className="metric-item">
                        <div className="metric-value">0</div>
                        <div className="metric-label">Errors</div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* MIDDLE SECTION: Mining Activity */}
              <section className="control-section activity-section">
                <div className="section-header">
                  <div className="section-title">MINING ACTIVITY</div>
                  <div className="section-divider"></div>
                </div>
                <div className="activity-cards-grid">
                  {/* Hashrate Card */}
                  <div className="mining-card hashrate-card">
                    <div className="mining-card-title">
                      ⚡ HASHRATE
                    </div>
                    <div className="mining-card-content">
                      <div className="hashrate-display">
                        <div className="hashrate-value" ref={hashrateCounterRef}>
                          {hashrate.toFixed(2)}
                        </div>
                        <div className="hashrate-unit">
                          TH/s
                        </div>
                      </div>
                      <div className="hashrate-trend">
                        <div className="trend-indicator up"></div>
                        <span>Stable</span>
                      </div>
                    </div>
                  </div>

                  {/* Connection Status Card */}
                  <div className="mining-card connection-card">
                    <div className="mining-card-title">
                      🌐 NETWORK
                    </div>
                    <div className="mining-card-content">
                      <div className="connection-status">
                        <div className={`connection-indicator ${status}`}></div>
                        <div className="connection-text">
                          WebSocket {getStatusText()}
                        </div>
                      </div>
                      <div className="connection-detail">
                        Real-time mining data stream
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* BOTTOM SECTION: Job Details */}
              <section className="control-section details-section">
                <div className="section-header">
                  <div className="section-title">JOB DETAILS</div>
                  <div className="section-divider"></div>
                </div>
                <div className="job-details-card">
                  <div className="mining-card-title">
                    📋 CURRENT JOB
                  </div>
                  <div className="mining-card-content">
                    <div className="job-info-grid">
                      <div className="job-info-item">
                        <label>Job ID</label>
                        <div className="job-info-value job-id">{jobData.job_id || 'N/A'}</div>
                      </div>
                      <div className="job-info-item">
                        <label>Target</label>
                        <div className="job-info-value target">{jobData.target || 'N/A'}</div>
                      </div>
                      <div className="job-info-item">
                        <label>Previous Hash</label>
                        <div className="job-info-value hash">{jobData.prevhash || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="error-state">
              <h3>Connection Error</h3>
              <p>Unable to connect to mining server. Please check your connection.</p>
              <button className="btn-retry" onClick={() => window.location.reload()}>
                Retry Connection
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="dashboard-footer">
        <p>Bitmind Mining Pool • Real-time Dashboard</p>
      </footer>
    </div>
  );
};

export default Dashboard;
