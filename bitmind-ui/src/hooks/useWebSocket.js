import { useState, useEffect, useCallback, useRef } from 'react';
import wsService from '../services/ws';

/**
 * WebSocket Hook
 * Provides WebSocket connection management and data streaming
 * Preserves existing endpoints and functionality
 */
export const useWebSocket = () => {
  const [status, setStatus] = useState('disconnected');
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [reconnectDelay, setReconnectDelay] = useState(1000);
  
  const handlersRef = useRef({
    onOpen: null,
    onMessage: null,
    onError: null,
    onClose: null
  });
  
  const reconnectTimeoutRef = useRef(null);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000;
  const maxReconnectDelay = 30000;

  // Handle WebSocket open event
  const handleOpen = useCallback((data) => {
    console.log('WebSocket connected in hook:', data);
    setStatus('connected');
    setIsConnected(true);
    setError(null);
    
    // Reset reconnection state on successful connection
    setReconnectAttempts(0);
    setReconnectDelay(baseReconnectDelay);
    
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (handlersRef.current.onOpen) {
      handlersRef.current.onOpen(data);
    }
  }, []);

  // Handle WebSocket message event
  const handleMessage = useCallback((message) => {
    console.log('WebSocket message in hook:', message);

    // STRICT MESSAGE TYPE HANDLING - Only allow device-related messages
    if (message.type === 'devices' || message.type === 'device_update') {
      console.log('Device message received:', message.type);
      
      if (handlersRef.current.onMessage) {
        handlersRef.current.onMessage(message);
      }
    } else {
      console.log('Ignoring non-device message type:', message.type);
      // Safely ignore all other message types
    }
  }, []);

  // Handle WebSocket error event
  const handleError = useCallback((errorData) => {
    console.error('WebSocket error in hook:', errorData);
    setStatus('error');
    setError(errorData);
    
    if (handlersRef.current.onError) {
      handlersRef.current.onError(errorData);
    }
  }, []);

  // Handle WebSocket close event
  const handleClose = useCallback((data) => {
    console.log('WebSocket closed in hook:', data);
    setIsConnected(false);
    
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    // Check if we should attempt reconnection
    if (reconnectAttempts < maxReconnectAttempts) {
      setStatus('reconnecting');
      setError(null);
      
      // Calculate exponential backoff delay
      const nextDelay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttempts), maxReconnectDelay);
      setReconnectDelay(nextDelay);
      
      console.log(`Reconnecting in ${nextDelay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        setReconnectAttempts(prev => prev + 1);
        wsService.connect().catch(error => {
          console.error('Reconnection failed:', error);
          setStatus('error');
          setError({ type: 'reconnect_failed', error });
        });
      }, nextDelay);
    } else {
      setStatus('disconnected');
      setError({ type: 'max_reconnect_attempts', attempts: reconnectAttempts });
    }
    
    if (handlersRef.current.onClose) {
      handlersRef.current.onClose(data);
    }
  }, [reconnectAttempts]);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (status === 'connected' || status === 'connecting') {
      return;
    }

    setStatus('connecting');
    setError(null);

    try {
      await wsService.connect();
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setStatus('error');
      setError({ type: 'connection_error', error });
    }
  }, [status]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    wsService.disconnect();
    setStatus('disconnected');
    setIsConnected(false);
  }, []);

  // Send message through WebSocket
  const send = useCallback((data) => {
    return wsService.send(data);
  }, []);

  // Register event handlers
  const registerHandlers = useCallback((handlers) => {
    handlersRef.current = { ...handlersRef.current, ...handlers };
  }, []);

  // Setup event listeners
  useEffect(() => {
    wsService.addListener('open', handleOpen);
    wsService.addListener('message', handleMessage);
    wsService.addListener('error', handleError);
    wsService.addListener('close', handleClose);

    return () => {
      wsService.removeListener('open', handleOpen);
      wsService.removeListener('message', handleMessage);
      wsService.removeListener('error', handleError);
      wsService.removeListener('close', handleClose);
    };
  }, [handleOpen, handleMessage, handleError, handleClose]);

  // Initial device data fetch
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await fetch('/api/miners');
        if (response.ok) {
          const devices = await response.json();
          console.log('Miners loaded:', devices);
        }
      } catch (error) {
        console.error('Failed to fetch miner data:', error);
      }
    };

    // Fetch miner data on component mount
    fetchDevices();
  }, []);

  return {
    // Connection state
    status,
    isConnected,
    error,
    reconnectAttempts,
    reconnectDelay,
    
    // Actions
    connect,
    disconnect,
    send,
    registerHandlers,
    
    // Raw service access (for advanced usage)
    service: wsService
  };
};

export default useWebSocket;
