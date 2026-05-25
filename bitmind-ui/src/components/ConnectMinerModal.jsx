import React, { useState } from 'react';
import Button from './ui/Button';
import './ConnectMinerModal.css';

/**
 * Connect Miner Modal
 * Onboarding flow for registering miner identity + wallet + device type
 */
const ConnectMinerModal = ({ isOpen, onClose, onConnect }) => {
  const [formData, setFormData] = useState({
    walletAddress: '',
    workerName: '',
    deviceType: 'esp32',
    miningMode: 'standard'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const deviceTypes = [
    { value: 'esp32', label: 'ESP32 Bitminer' },
    { value: 'asic', label: 'ASIC Miner' },
    { value: 'gpu', label: 'GPU Miner' },
    { value: 'cpu', label: 'CPU Miner' }
  ];

  const miningModes = [
    { value: 'standard', label: 'Standard' },
    { value: 'eco', label: 'Eco Mode' },
    { value: 'turbo', label: 'Turbo Mode' }
  ];

  const validateWalletAddress = (address) => {
    // Basic Bitcoin address validation
    const bitcoinAddressRegex = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/;
    return bitcoinAddressRegex.test(address);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("STEP 3 SUBMIT");
    alert("SUBMIT WORKS");
    setError('');

    try {
      console.log("FORM DATA:", formData);
    } catch (err) {
      console.error("❌ CRASH BEFORE API CALL:", err);
      setError('Internal error: ' + err.message);
      return;
    }

    console.log('CONNECT MINER SUBMIT TRIGGERED');
    console.log('Form data:', formData);

    // Validation
    if (!formData.walletAddress.trim()) {
      setError('Wallet address is required');
      return;
    }

    if (!validateWalletAddress(formData.walletAddress)) {
      setError('Invalid Bitcoin wallet address');
      return;
    }

    if (!formData.workerName.trim()) {
      setError('Worker name is required');
      return;
    }

    if (formData.workerName.length < 3) {
      setError('Worker name must be at least 3 characters');
      return;
    }

    setLoading(true);
    console.log('Calling onConnect with formData...');

    try {
      await onConnect(formData);
      console.log('onConnect succeeded');
      // Modal will be closed by parent on success
    } catch (err) {
      console.error('onConnect failed:', err);
      setError(err.message || 'Failed to connect miner');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (!isOpen) {
    console.log("MODAL NOT MOUNTING - isOpen is false");
    return null;
  }

  console.log("MODAL MOUNTING - isOpen is true");
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Connect Your Miner</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="walletAddress">
              Bitcoin Wallet Address <span className="required">*</span>
            </label>
            <input
              type="text"
              id="walletAddress"
              name="walletAddress"
              value={formData.walletAddress}
              onChange={handleChange}
              placeholder="bc1q..."
              disabled={loading}
              className="form-input"
            />
            <small className="form-hint">Your Bitcoin wallet for mining rewards</small>
          </div>

          <div className="form-group">
            <label htmlFor="workerName">
              Worker Name <span className="required">*</span>
            </label>
            <input
              type="text"
              id="workerName"
              name="workerName"
              value={formData.workerName}
              onChange={handleChange}
              placeholder="my-miner-01"
              disabled={loading}
              className="form-input"
            />
            <small className="form-hint">Unique identifier for your miner</small>
          </div>

          <div className="form-group">
            <label htmlFor="deviceType">
              Device Type <span className="required">*</span>
            </label>
            <select
              id="deviceType"
              name="deviceType"
              value={formData.deviceType}
              onChange={handleChange}
              disabled={loading}
              className="form-select"
            >
              {deviceTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="miningMode">
              Mining Mode
            </label>
            <select
              id="miningMode"
              name="miningMode"
              value={formData.miningMode}
              onChange={handleChange}
              disabled={loading}
              className="form-select"
            >
              {miningModes.map(mode => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
            <small className="form-hint">Optional: Choose power consumption mode</small>
          </div>

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}

          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={loading}
            >
              {loading ? 'Connecting...' : 'Connect Miner'}
            </Button>
          </div>
        </form>

        <div className="modal-footer">
          <p className="modal-info">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            Your miner will be registered and connected to the pool
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConnectMinerModal;
