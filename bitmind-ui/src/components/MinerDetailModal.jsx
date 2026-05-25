import React, { memo } from 'react';
import './MinerDetailModal.css';

/**
 * Miner Detail Modal Component
 * Shows detailed miner information in a modal
 */
const MinerDetailModal = memo(({ device, onClose }) => {
  if (!device) return null;

  // Format functions
  const formatUptime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatHashrate = (hashrate) => {
    if (hashrate >= 1000) {
      return `${(hashrate / 1000).toFixed(1)} KH/s`;
    }
    return `${hashrate} H/s`;
  };

  const formatLastSeen = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const calculateEfficiency = () => {
    if (!device.acceptedShares && !device.rejectedShares) return '0%';
    const total = device.acceptedShares + device.rejectedShares;
    if (total === 0) return '0%';
    return ((device.acceptedShares / total) * 100).toFixed(1) + '%';
  };

  // Get display name
  const getDisplayName = () => {
    return device.workerName || device.deviceId;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-miner-detail" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon">⚡</div>
          <h3 className="modal-title">MINER DETAILS</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Identity Section */}
          <div className="detail-section">
            <div className="detail-section-title">IDENTITY</div>
            <div className="detail-row">
              <span className="detail-label">Worker Name</span>
              <span className="detail-value primary">{getDisplayName()}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Device ID</span>
              <span className="detail-value secondary">{device.deviceId}</span>
            </div>
          </div>

          {/* Live Metrics Section */}
          <div className="detail-section">
            <div className="detail-section-title">LIVE METRICS</div>
            <div className="detail-row">
              <span className="detail-label">Hashrate</span>
              <span className="detail-value">{formatHashrate(device.hashrate || 0)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Accepted Shares</span>
              <span className="detail-value success">{device.acceptedShares || 0}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Rejected Shares</span>
              <span className="detail-value error">{device.rejectedShares || 0}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Efficiency</span>
              <span className="detail-value">{calculateEfficiency()}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Uptime</span>
              <span className="detail-value">{formatUptime(device.uptime || 0)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Last Seen</span>
              <span className="detail-value">{formatLastSeen(device.lastSeen || 0)}</span>
            </div>
          </div>

          {/* System Info Section */}
          <div className="detail-section">
            <div className="detail-section-title">SYSTEM INFO</div>
            <div className="detail-row">
              <span className="detail-label">Status</span>
              <span className={`detail-value status-${device.status}`}>{device.status}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">WebSocket State</span>
              <span className="detail-value">{device.websocketState || 'unknown'}</span>
            </div>
            {device.reconnectCount !== undefined && (
              <div className="detail-row">
                <span className="detail-label">Reconnect Count</span>
                <span className="detail-value">{device.reconnectCount}</span>
              </div>
            )}
            {device.firmwareVersion && (
              <div className="detail-row">
                <span className="detail-label">Firmware Version</span>
                <span className="detail-value">{device.firmwareVersion}</span>
              </div>
            )}
            {device.ipAddress && (
              <div className="detail-row">
                <span className="detail-label">IP Address</span>
                <span className="detail-value">{device.ipAddress}</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-close" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
});

MinerDetailModal.displayName = 'MinerDetailModal';

export default MinerDetailModal;
