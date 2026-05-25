import React, { useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import Button from '../components/ui/Button';
import ConnectMinerModal from '../components/ConnectMinerModal';
import './Landing.css';

// Debug flag
if (typeof window !== 'undefined') {
  window.__BITMIND_DEBUG = true;
}

/**
 * Landing Page
 * Entry point for Bitmind application
 * Shows connection options and WebSocket status
 */
const Landing = ({ onConnect }) => {
  // Runtime injection - MUST execute immediately
  console.log("🔥 BITMIND FRONTEND EXECUTING");
  window.__BITMIND_RUNTIME = true;

  const { status, connect, isConnected } = useWebSocket();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleConnectBitminer = () => {
    console.log("STEP 1 BUTTON CLICK");
    alert("CLICK WORKS");
    // Open modal instead of direct connection
    setIsModalOpen(true);
    console.log("STEP 2 MODAL OPEN");
  };

  const handleMinerConnect = async (formData) => {
    console.log('LANDING: handleMinerConnect called with formData:', formData);

    try {
      // Connect WebSocket FIRST before registering miner
      // This ensures miner_connected event is received
      console.log('LANDING: Connecting WebSocket first...');
      await connect();

      if (!isConnected) {
        console.warn('LANDING: WebSocket not connected, proceeding anyway');
      } else {
        console.log('LANDING: WebSocket connected successfully');
      }

      const apiUrl = '/api/miners/connect'; // Use relative path for Nginx proxy
      console.log('STEP 4 API REQUEST:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      console.log('LANDING: API response status:', response.status);
      const result = await response.json();
      console.log('LANDING: API response body:', result);

      if (result.success) {
        console.log('STEP 5 API SUCCESS');
        console.log('LANDING: Miner connected successfully:', result.miner);
        setIsModalOpen(false);

        // WebSocket is already connected, just navigate
        if (isConnected) {
          console.log('LANDING: Calling onConnect to navigate to dashboard');
          onConnect();
        } else {
          console.warn('LANDING: WebSocket still not connected after miner registration');
        }
      } else {
        throw new Error(result.error || 'Failed to connect miner');
      }
    } catch (error) {
      console.error('LANDING: Failed to connect miner:', error);
      throw error;
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

      {/* Connect Miner Modal */}
      <ConnectMinerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConnect={handleMinerConnect}
      />
    </div>
  );
};

export default Landing;
