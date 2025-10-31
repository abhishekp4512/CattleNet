import { useState, useEffect } from 'react';

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Checking...');

  const checkConnection = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/mqtt-status');
      if (response.ok) {
        const data = await response.json();
        setIsConnected(data.mqtt_connected || false);
        setConnectionStatus(data.mqtt_connected ? 'Connected' : 'Disconnected');
      } else {
        setIsConnected(false);
        setConnectionStatus('Server Error');
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      setIsConnected(false);
      setConnectionStatus('Connection Failed');
    }
  };

  useEffect(() => {
    checkConnection();
    
    // Check connection status every 10 seconds
    const interval = setInterval(checkConnection, 10000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    isConnected,
    connectionStatus,
    checkConnection
  };
};