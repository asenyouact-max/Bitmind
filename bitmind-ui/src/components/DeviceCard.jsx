import React, { memo, useMemo } from 'react';
import './DeviceCard.css';

/**
 * Memoized Device Card Component
 * Prevents unnecessary re-renders for performance
 */
const DeviceCard = memo(({ device, onClick }) => {
  // Format uptime
  const formatUptime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  // Format hashrate
  const formatHashrate = (hashrate) => {
    if (hashrate >= 1000) {
      return `${(hashrate / 1000).toFixed(1)} KH/s`;
    }
    return `${hashrate} H/s`;
  };

  // Format last seen
  const formatLastSeen = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  // Status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return '#10b981';
      case 'offline': return '#ef4444';
      case 'reconnecting': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  // Mining status color
  const getMiningStatusColor = (status) => {
    switch (status) {
      case 'mining': return '#10b981';
      case 'idle': return '#6b7280';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  // Calculate efficiency
  const calculateEfficiency = () => {
    if (!device.acceptedShares && !device.rejectedShares) return '0%';
    const total = device.acceptedShares + device.rejectedShares;
    if (total === 0) return '0%';
    return ((device.acceptedShares / total) * 100).toFixed(1) + '%';
  };

  // Get display name (workerName first, fallback to deviceId)
  const getDisplayName = () => {
    return device.workerName || device.deviceId;
  };

  return (
    <div className="device-card" onClick={() => onClick && onClick(device)} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="device-header">
        <div className="device-info">
          <h3 className="device-id">{getDisplayName()}</h3>
          {device.workerName && device.workerName !== device.deviceId && (
            <span className="device-source">{device.deviceId}</span>
          )}
        </div>
        <div className="device-status">
          <div 
            className="status-dot"
            style={{ backgroundColor: getStatusColor(device.status) }}
          />
          <span className="status-text">{device.status}</span>
        </div>
      </div>
      
      {/* Mining Information */}
      {device.miningStatus && (
        <div className="device-mining-info">
          <div className="mining-header">
            <span className="mining-status">
              <div 
                className="mining-dot"
                style={{ backgroundColor: getMiningStatusColor(device.miningStatus) }}
              />
              {device.miningStatus}
            </span>
            {device.activeJobId && (
              <span className="job-id">Job: {device.activeJobId.substring(0, 8)}...</span>
            )}
          </div>
        </div>
      )}
      
      <div className="device-metrics">
        <div className="metric">
          <span className="metric-label">Hashrate</span>
          <span className="metric-value">{formatHashrate(device.hashrate || 0)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Uptime</span>
          <span className="metric-value">{formatUptime(device.uptime || 0)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Efficiency</span>
          <span className="metric-value">{calculateEfficiency()}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Status</span>
          <span className="metric-value">{device.status}</span>
        </div>
      </div>
    </div>
  );
});

DeviceCard.displayName = 'DeviceCard';

export default DeviceCard;
