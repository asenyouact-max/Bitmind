import React from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import Button from '../components/ui/Button';
import './Landing.css';

/**
 * Landing Page
 * Entry point for Bitmind application
 * Shows connection options and WebSocket status
 */
const Landing = ({ onConnect }) => {
  const { status, connect, isConnected } = useWebSocket();

  const handleConnectBitminer = async () => {
    try {
      await connect();
      // Parent component will handle navigation based on isConnected change
      if (isConnected) {
        onConnect();
      }
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const handleBuyBitminer = () => {
    // Placeholder for future functionality
    console.log('Buy Bitminer clicked - placeholder action');
    // Could open external link or show modal in future
    alert('Bitminer purchase coming soon!');
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

  return (
    <div className="landing">
      <div className="landing-container">
        {/* WebSocket Status Indicator */}
        <div className="status-indicator">
          <div 
            className="status-dot" 
            style={{ backgroundColor: getStatusColor() }}
          />
          <span className="status-text">{getStatusText()}</span>
        </div>

        {/* Main Content */}
        <div className="landing-content">
          <h1 className="landing-title">Bitmind</h1>
          <p className="landing-subtitle">Real-time Bitcoin Mining Control System</p>
          
          <div className="landing-buttons">
            <Button 
              variant="primary"
              onClick={handleConnectBitminer}
              disabled={status === 'connecting'}
              loading={status === 'connecting'}
              className="ignition-button"
            >
              {status === 'connecting' ? 'Initializing...' : 'Connect Bitminer'}
              <span className="button-microcopy">Initialize mining node</span>
            </Button>
            
            <Button 
              variant="secondary"
              onClick={handleBuyBitminer}
              className="hardware-button"
            >
              Buy Bitminer
              <span className="button-microcopy">Get hardware access</span>
            </Button>
          </div>
        </div>

        {/* Footer Info */}
        <div className="landing-footer">
          <p>Advanced Bitcoin Mining Pool Dashboard</p>
        </div>
      </div>
    </div>
  );
};

export default Landing;
