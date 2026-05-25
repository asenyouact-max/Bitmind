import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { connectWebSocket } from './services/ws';
import DeviceCard from './components/DeviceCard';
import VirtualizedDeviceList from './components/VirtualizedDeviceList';
import TopMinersLeaderboard from './components/TopMinersLeaderboard';
import './App.css';

/**
 * Premium Bitcoin Mining Control Dashboard
 * Complete dashboard with navbar, hero, statistics, and live feed
 */
function App() {
  const { isConnected, status, connect, disconnect, reconnectAttempts, reconnectDelay } = useWebSocket();
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [activeStatsTab, setActiveStatsTab] = useState('shares');
  const [activeFeedTab, setActiveFeedTab] = useState('all');
  const [events, setEvents] = useState([]);
  const [devices, setDevices] = useState([]);
  const canvasRef = useRef(null);
  
  // Device state stability tracking
  const deviceTimeoutsRef = useRef({});
  const gracePeriodMs = 15000; // 15 seconds grace period
  const cleanupPeriodMs = 60000; // 60 seconds cleanup period

  // Fetch real device data from API
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/devices`);
        if (response.ok) {
          const devices = await response.json();
          setDevices(devices);
          
          // Convert devices to events for feed
          const deviceEvents = devices.map(device => ({
            id: device.deviceId,
            type: 'device',
            title: `Device ${device.status}`,
            detail: `${device.deviceId} - ${device.hashrate} H/s`,
            timestamp: `${Math.floor(device.uptime)}s ago`,
            color: device.status === 'online' ? 'green' : 'red'
          }));
          setEvents(deviceEvents);
        }
      } catch (error) {
        console.error('Failed to fetch device data:', error);
      }
    };

    fetchDevices();
  }, []);

  // Device cleanup effect
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      setDevices(prevDevices => {
        const currentTime = Date.now();
        const cleanedDevices = prevDevices.filter(device => {
          const timeSinceLastSeen = currentTime - device.lastSeen;
          // Keep device if online or offline for less than 60 seconds
          return device.status === 'online' || timeSinceLastSeen < cleanupPeriodMs;
        });
        
        // Log removed devices for debugging
        const removedDevices = prevDevices.filter(device => {
          const timeSinceLastSeen = currentTime - device.lastSeen;
          return device.status === 'offline' && timeSinceLastSeen >= cleanupPeriodMs;
        });
        
        if (removedDevices.length > 0) {
          console.log('Cleaned up offline devices:', removedDevices.map(d => d.deviceId));
        }
        
        return cleanedDevices;
      });
    }, cleanupPeriodMs);

    return () => {
      clearInterval(cleanupInterval);
      // Clear all device timeouts
      Object.values(deviceTimeoutsRef.current).forEach(timeout => clearTimeout(timeout));
      deviceTimeoutsRef.current = {};
    };
  }, []);

  // Canvas animation for floating orbs
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = document.body.scrollHeight;

    const particles = [];
    const glows = [];

    // Create particles
    for (let i = 0; i < 38; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 3 + 1,
        alpha: Math.random() * 0.2 + 0.05,
        color: Math.random() > 0.7 ? '#00c3ff' : '#f7931a',
        trail: []
      });
    }

    // Create ambient glows
    for (let i = 0; i < 5; i++) {
      glows.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 90 + 60,
        alpha: Math.random() * 0.03 + 0.01,
        color: Math.random() > 0.5 ? '#f7931a' : '#00c3ff'
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw glows
      glows.forEach(glow => {
        const gradient = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, glow.size);
        gradient.addColorStop(0, glow.color + Math.floor(glow.alpha * 255).toString(16).padStart(2, '0'));
        gradient.addColorStop(1, glow.color + '00');
        ctx.fillStyle = gradient;
        ctx.fillRect(glow.x - glow.size, glow.y - glow.size, glow.size * 2, glow.size * 2);
      });

      // Draw particles
      particles.forEach(particle => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // Update trail
        particle.trail.push({ x: particle.x, y: particle.y });
        if (particle.trail.length > 10) particle.trail.shift();

        // Draw trail
        particle.trail.forEach((point, index) => {
          ctx.globalAlpha = (index / particle.trail.length) * particle.alpha;
          ctx.fillStyle = particle.color;
          ctx.fillRect(point.x, point.y, particle.size, particle.size);
        });

        // Draw particle
        ctx.globalAlpha = particle.alpha + Math.sin(Date.now() * 0.001 + particle.x) * 0.05;
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
      });

      ctx.globalAlpha = 1;
      requestAnimationFrame(animate);
    };

    animate();
  }, []);

  const handleConnectMiner = () => {
    connectWebSocket((msg) => {
      // Handle real-time device updates from WebSocket - MERGE-BASED ONLY
      if (msg.type === "devices") {
        setDevices(prevDevices => {
          const updatedDevices = [...prevDevices];
          const currentTime = Date.now();
          
          msg.data.forEach(newDevice => {
            const existingIndex = updatedDevices.findIndex(d => d.deviceId === newDevice.deviceId);
            
            if (existingIndex !== -1) {
              // MERGE UPDATE - preserve existing state, only update provided fields
              const existingDevice = updatedDevices[existingIndex];
              updatedDevices[existingIndex] = {
                ...existingDevice,
                status: newDevice.status,
                hashrate: newDevice.hashrate !== undefined ? newDevice.hashrate : existingDevice.hashrate,
                uptime: newDevice.uptime !== undefined ? newDevice.uptime : existingDevice.uptime,
                lastSeen: newDevice.lastSeen !== undefined ? newDevice.lastSeen : existingDevice.lastSeen
              };
              
              // Clear any existing timeout for this device
              if (deviceTimeoutsRef.current[newDevice.deviceId]) {
                clearTimeout(deviceTimeoutsRef.current[newDevice.deviceId]);
                delete deviceTimeoutsRef.current[newDevice.deviceId];
              }
            } else {
              // ADD NEW DEVICE - ONLY if truly doesn't exist
              updatedDevices.push(newDevice);
            }
            
            // Set timeout for device state management
            deviceTimeoutsRef.current[newDevice.deviceId] = setTimeout(() => {
              setDevices(prev => {
                const deviceIndex = prev.findIndex(d => d.deviceId === newDevice.deviceId);
                if (deviceIndex !== -1) {
                  const updated = [...prev];
                  updated[deviceIndex] = { ...updated[deviceIndex], status: 'offline' };
                  return updated;
                }
                return prev;
              });
            }, gracePeriodMs);
          });
          
          return updatedDevices;
        });
      }

      // Handle mining updates from backend
      if (msg.type === "mining_update") {
        setDevices(prevDevices => {
          const updatedDevices = [...prevDevices];
          const deviceIndex = updatedDevices.findIndex(d => d.deviceId === msg.deviceId);
          
          if (deviceIndex !== -1) {
            // MERGE UPDATE - preserve existing state, update mining fields
            const existingDevice = updatedDevices[deviceIndex];
            updatedDevices[deviceIndex] = {
              ...existingDevice,
              miningHashrate: msg.device.miningHashrate,
              acceptedShares: msg.device.acceptedShares,
              temperature: msg.device.temperature,
              activeJobId: msg.device.activeJobId,
              miningStatus: msg.device.miningStatus,
              lastSeen: msg.device.lastSeen
            };
          }
          
          return updatedDevices;
        });
      }

      // Handle share found events
      if (msg.type === "share_found_event") {
        // Add to events feed
        setEvents(prevEvents => [
          {
            id: Date.now(),
            type: 'share_found',
            deviceId: msg.data.deviceId,
            message: `Share found by ${msg.data.deviceId}`,
            details: `Nonce: ${msg.data.nonce}, Job: ${msg.data.jobId.substring(0, 8)}...`,
            timestamp: new Date().toISOString()
          },
          ...prevEvents.slice(0, 49) // Keep last 50 events
        ]);
      }

      // Handle pseudo share valid events
      if (msg.type === "pseudo_share_valid") {
        // Add to events feed
        setEvents(prevEvents => [
          {
            id: Date.now(),
            type: 'pseudo_share_valid',
            deviceId: msg.data.deviceId,
            message: `âœ… Valid PSEUDO share by ${msg.data.deviceId}`,
            details: `Nonce: ${msg.data.nonce}, Hash: ${msg.data.hash.substring(0, 16)}..., Reason: ${msg.data.reason}`,
            timestamp: new Date().toISOString()
          },
          ...prevEvents.slice(0, 49) // Keep last 50 events
        ]);
      }

      // Handle pseudo share invalid events
      if (msg.type === "pseudo_share_invalid") {
        // Add to events feed
        setEvents(prevEvents => [
          {
            id: Date.now(),
            type: 'pseudo_share_invalid',
            deviceId: msg.data.deviceId,
            message: `âŒ Invalid PSEUDO share by ${msg.data.deviceId}`,
            details: `Nonce: ${msg.data.nonce}, Reason: ${msg.data.reason}, Hash: ${msg.data.hash.substring(0, 16)}...`,
            timestamp: new Date().toISOString()
          },
          ...prevEvents.slice(0, 49) // Keep last 50 events
        ]);
      }

      // Handle device updates (original logic)
      if (msg.type === "device_update") {
        // Handle batched device updates for performance
        setDevices(prevDevices => {
          const existingIndex = prevDevices.findIndex(d => d.deviceId === msg.deviceId);
          if (existingIndex !== -1) {
            const updated = [...prevDevices];
            updated[existingIndex] = { ...updated[existingIndex], ...msg.device };
            return updated;
          }
          return prevDevices;
        });
      }
    });
  };

  return (
    <div className="App">
      {/* Floating Orbs Background */}
      <canvas ref={canvasRef} className="orb-canvas" />

      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-left">
          <div className="logo">
            <div className="logo-icon">&#x20BF;</div>
            <span className="logo-text">BITMIND</span>
          </div>
          <div className="nav-links">
            <a href="#" className="nav-link">Monitor</a>
            <a href="#" className="nav-link">Hardware</a>
            <a href="#" className="nav-link">Miners</a>
          </div>
        </div>
        
        <div className="nav-right">
          <div className="bridge-status">
            <div className={`status-dot ${status === 'connected' ? 'online' : status === 'reconnecting' ? 'yellow' : 'offline'}`}></div>
            <span className="status-text">
              {status === 'connected' ? 'CONNECTED' : 
               status === 'reconnecting' ? `RECONNECTING... (${reconnectAttempts}/${5})` : 
               status === 'connecting' ? 'CONNECTING...' : 'DISCONNECTED'}
            </span>
          </div>
          <button className="btn-buy" onClick={() => setShowBuyModal(true)}>
            BUY BITMINER
          </button>
          <button className="btn-connect" onClick={handleConnectMiner}>
            CONNECT MINER
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-left">
          <div className="status-pill">
            <div className="status-dot online"></div>
            NODE ONLINE: MAINNET
          </div>
          <h1 className="hero-title">
            MINE THE<br />
            <span className="hero-title-orange">FUTURE</span>
          </h1>
          <p className="hero-subtitle">
            The ultimate dashboard for the modern solo miner. Connect your node, monitor your hashrate, and secure the network with precision-engineered hardware.
          </p>
          <div className="hero-ctas">
            <button className="btn-primary">Connect Bitminer â†’</button>
            <button className="btn-secondary">Buy Bitminer</button>
          </div>
        </div>
        
        <div className="hero-right">
          <div className="scene-3d">
            <div className="ambient-glow" />
            <div className="ring ring-1" />
            <div className="ring ring-2" />
            <div className="ring ring-3" />
            <div className="orbit-wrap">
              <div className="odot odot-orange" />
              <div className="odot odot-cyan" />
            </div>
            <div className="btc-coin">
              <span className="btc-sym">&#x20BF;</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="main-grid">
        {/* Top Miners Leaderboard */}
        <TopMinersLeaderboard devices={devices} limit={5} />

        {/* Mining Statistics Panel */}
        <div className="panel stats-panel">
          <div className="panel-header">
            <span className="panel-icon">â›ï¸</span>
            <h3 className="panel-title">MINING STATISTICS</h3>
          </div>
          <div className="panel-tabs">
            <button 
              className={`tab ${activeStatsTab === 'shares' ? 'active' : ''}`}
              onClick={() => setActiveStatsTab('shares')}
            >
              SHARES/MIN
            </button>
            <button 
              className={`tab ${activeStatsTab === 'acceptance' ? 'active' : ''}`}
              onClick={() => setActiveStatsTab('acceptance')}
            >
              ACCEPTANCE
            </button>
            <button 
              className={`tab ${activeStatsTab === 'performance' ? 'active' : ''}`}
              onClick={() => setActiveStatsTab('performance')}
            >
              PERFORMANCE
            </button>
          </div>
          <div className="chart-area">
            <div className="chart-placeholder">
              <div className="chart-line"></div>
            </div>
          </div>
          <div className="stats-row">
            <div className="stat-item">
              <div className="stat-dot green"></div>
              <span className="stat-label">Accepted: 42</span>
            </div>
            <div className="stat-item">
              <div className="stat-dot red"></div>
              <span className="stat-label">Rejected: 3</span>
            </div>
          </div>
        </div>

        {/* Live Event Feed */}
        <div className="panel feed-panel">
          <div className="panel-header">
            <span className="panel-icon">ðŸ”¥</span>
            <h3 className="panel-title">LIVE EVENT FEED</h3>
            <div className="live-badge">
              <div className="live-dot"></div>
              LIVE
            </div>
          </div>
          <div className="panel-tabs">
            <button 
              className={`tab ${activeFeedTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFeedTab('all')}
            >
              ALL
            </button>
            <button 
              className={`tab ${activeFeedTab === 'shares' ? 'active' : ''}`}
              onClick={() => setActiveFeedTab('shares')}
            >
              SHARES
            </button>
            <button 
              className={`tab ${activeFeedTab === 'jobs' ? 'active' : ''}`}
              onClick={() => setActiveFeedTab('jobs')}
            >
              JOBS
            </button>
            <button 
              className={`tab ${activeFeedTab === 'devices' ? 'active' : ''}`}
              onClick={() => setActiveFeedTab('devices')}
            >
              DEVICES
            </button>
          </div>
          <div className="feed-content">
            {activeFeedTab === 'devices' ? (
              // REAL-TIME DEVICE CARDS (Virtualized for 50+ devices)
              devices.length > 0 ? (
                <VirtualizedDeviceList 
                  devices={devices}
                  onDeviceUpdate={(deviceId, updates) => {
                    // Handle device updates efficiently
                    setDevices(prev => {
                      const index = prev.findIndex(d => d.deviceId === deviceId);
                      if (index !== -1) {
                        const updated = [...prev];
                        updated[index] = { ...updated[index], ...updates };
                        return updated;
                      }
                      return prev;
                    });
                  }}
                />
              ) : (
                <div className="feed-empty">
                  <div className="empty-pulse"></div>
                  <div className="empty-text">No devices connected</div>
                  <div className="empty-subtext">Connect your ESP32 to see devices here</div>
                </div>
              )
            ) : (
              // EVENT FEED (SHARED/JOBS/DEVICES TABS)
              events.length > 0 ? (
                events.map(event => (
                  <div key={event.id} className="feed-item">
                    <div className={`feed-icon ${event.color}`}>
                      {event.type === 'share' && 'âœ“'}
                      {event.type === 'job' && 'âš¡'}
                      {event.type === 'device' && 'ðŸ“¡'}
                    </div>
                    <div className="feed-content-inner">
                      <div className="feed-title">{event.title}</div>
                      <div className="feed-detail">{event.detail}</div>
                    </div>
                    <div className="feed-timestamp">{event.timestamp}</div>
                  </div>
                ))
              ) : (
                <div className="feed-empty">
                  <div className="empty-pulse"></div>
                  <div className="empty-text">Waiting for mining activity...</div>
                  <div className="empty-subtext">Events will appear here in real-time</div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Status Row */}
      <div className="status-row">
        <div className="status-card">
          <div className="status-label">NODE STATUS</div>
          <div className="status-value">
            <div className="status-dot yellow"></div>
            SYNCING
          </div>
          <div className="status-progress">
            <div className="progress-bar" style={{ width: '38%' }}></div>
          </div>
          <div className="status-sub">38% synced</div>
        </div>
        
        <div className="status-card">
          <div className="status-label">TOTAL HASHRATE</div>
          <div className="status-value orange">87.4 TH/s</div>
          <div className="status-sub">â†‘ Active</div>
        </div>
        
        <div className="status-card">
          <div className="status-label">SHARES FOUND</div>
          <div className="status-value cyan">42</div>
          <div className="status-sub">Last: 2s ago</div>
        </div>
        
        <div className="status-card">
          <div className="status-label">ACTIVE MINERS</div>
          <div className="status-value purple">3</div>
          <div className="status-sub">1 offline</div>
        </div>
      </div>

      {/* BUY BITMINER Modal */}
      {showBuyModal && (
        <div className="modal-overlay" onClick={() => setShowBuyModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon">âš¡</div>
              <div>
                <h3 className="modal-title">BITMIND ESP32 BITMINER</h3>
                <span className="modal-badge">NEW</span>
              </div>
            </div>
            
            <div className="modal-features">
              <div className="feature"><span className="feature-check">âœ“</span> Plug & play</div>
              <div className="feature"><span className="feature-check">âœ“</span> Auto-connects</div>
              <div className="feature"><span className="feature-check">âœ“</span> Low power</div>
              <div className="feature"><span className="feature-check">âœ“</span> Beginner friendly</div>
            </div>
            
            <div className="modal-specs">
              <div className="spec">
                <div className="spec-label">HASHRATE</div>
                <div className="spec-value orange">~50 MH/s</div>
              </div>
              <div className="spec">
                <div className="spec-label">POWER</div>
                <div className="spec-value">~5W</div>
              </div>
              <div className="spec">
                <div className="spec-label">PRICE</div>
                <div className="spec-value orange">â‚¬49</div>
              </div>
            </div>
            
            <div className="modal-how">
              <h4>How It Works</h4>
              <div className="how-steps">
                <div className="how-step">
                  <div className="step-number">1</div>
                  <span>Order your Bitminer</span>
                </div>
                <div className="how-step">
                  <div className="step-number">2</div>
                  <span>Connect to WiFi</span>
                </div>
                <div className="how-step">
                  <div className="step-number">3</div>
                  <span>Add wallet address</span>
                </div>
                <div className="how-step">
                  <div className="step-number">4</div>
                  <span>Start mining Bitcoin</span>
                </div>
              </div>
            </div>
            
            <button className="modal-cta">Order Now â€” â‚¬49 â†’</button>
          </div>
        </div>
      )}

      {/* CONNECT MINER Modal */}
      {showConnectModal && (
        <div className="modal-overlay" onClick={() => setShowConnectModal(false)}>
          <div className="modal modal-green" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon">âš¡</div>
              <h3 className="modal-title">CONNECT NEW MINER</h3>
            </div>
            
            <div className="modal-form">
              <div className="form-group">
                <label>MINER NAME (required)</label>
                <input type="text" placeholder="My Mining Rig" className="form-input" />
              </div>
              <div className="form-group">
                <label>WALLET ADDRESS (required)</label>
                <input type="text" placeholder="bc1q..." className="form-input" />
              </div>
              <div className="form-group">
                <label>WORKER NAME (optional)</label>
                <input type="text" placeholder="worker1" className="form-input" />
              </div>
              <div className="form-group">
                <label>MINER ID</label>
                <input type="text" placeholder="bitmind-esp32-xxxx" className="form-input" />
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowConnectModal(false)}>Cancel</button>
              <button className="btn-register">Register Miner â†’</button>
            </div>
          </div>
        </div>
      )}

      {/* Debug display for real devices - hidden */}
      <div style={{ display: "none" }}>
        {devices.map((d) => (
          <div key={d.id}>
            {d.id} - {d.status}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;

