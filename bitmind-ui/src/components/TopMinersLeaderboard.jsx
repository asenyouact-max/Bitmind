import React, { memo, useMemo } from 'react';
import './TopMinersLeaderboard.css';

/**
 * Top Miners Leaderboard Component
 * Shows top miners sorted by hashrate
 */
const TopMinersLeaderboard = memo(({ devices, limit = 5 }) => {
  // Sort and limit top miners
  const topMiners = useMemo(() => {
    return [...devices]
      .sort((a, b) => (b.hashrate || 0) - (a.hashrate || 0))
      .slice(0, limit);
  }, [devices, limit]);

  // Format functions
  const formatHashrate = (hashrate) => {
    if (hashrate >= 1000) {
      return `${(hashrate / 1000).toFixed(1)} KH/s`;
    }
    return `${hashrate} H/s`;
  };

  const getDisplayName = (device) => {
    return device.workerName || device.deviceId;
  };

  if (topMiners.length === 0) {
    return (
      <div className="top-miners-leaderboard">
        <div className="leaderboard-header">
          <span className="leaderboard-icon">🏆</span>
          <h3 className="leaderboard-title">TOP MINERS</h3>
        </div>
        <div className="leaderboard-empty">
          <div className="empty-text">No miners connected</div>
        </div>
      </div>
    );
  }

  return (
    <div className="top-miners-leaderboard">
      <div className="leaderboard-header">
        <span className="leaderboard-icon">🏆</span>
        <h3 className="leaderboard-title">TOP MINERS</h3>
      </div>
      <div className="leaderboard-list">
        {topMiners.map((miner, index) => (
          <div key={miner.deviceId} className="leaderboard-item">
            <div className="leaderboard-rank">
              <span className={`rank-badge rank-${index + 1}`}>{index + 1}</span>
            </div>
            <div className="leaderboard-info">
              <div className="leaderboard-name">{getDisplayName(miner)}</div>
              <div className="leaderboard-hashrate">{formatHashrate(miner.hashrate || 0)}</div>
            </div>
            <div className="leaderboard-status">
              <div className={`status-dot ${miner.status === 'online' || miner.status === 'mining' ? 'online' : 'offline'}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

TopMinersLeaderboard.displayName = 'TopMinersLeaderboard';

export default TopMinersLeaderboard;
