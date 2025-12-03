import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Checking...');
  const [lastMessage, setLastMessage] = useState(null);
  const socketRef = useRef(null);

  const checkConnection = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/mqtt-status');
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
    // Only create socket once
    if (!socketRef.current) {
      socketRef.current = io('http://localhost:5001', {
        transports: ['websocket'],
        reconnection: true,
      });

      // Set up WebSocket event listeners
      socketRef.current.on('connect', () => {
        console.log('✓ WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('Connected');
      });

      socketRef.current.on('disconnect', () => {
        console.log('✗ WebSocket disconnected');
        setIsConnected(false);
        setConnectionStatus('Disconnected');
      });

      socketRef.current.on('sensor_update', (data) => {
        console.log('📊 Received sensor update:', data);
        setLastMessage({ type: 'sensor_update', data });
      });

      // Backend emits 'feed_monitor_update' with shape { data: {...}, status }
      socketRef.current.on('feed_monitor_update', (payload) => {
        console.log('🍔 Received feed_monitor_update:', payload);
        const data = payload && payload.data ? payload.data : payload;
        setLastMessage({ type: 'feed_monitor', data });
      });

      // Backend emits 'gate_update' with shape { data: {...}, status }
      socketRef.current.on('gate_update', (payload) => {
        console.log('📍 Received gate_update:', payload);
        const data = payload && payload.data ? payload.data : payload;
        setLastMessage({ type: 'gate_update', data });
      });
    }

    checkConnection();

    // Check connection status every 10 seconds
    const interval = setInterval(checkConnection, 10000);

    return () => {
      clearInterval(interval);
      // Don't disconnect on unmount - keep connection alive
    };
  }, []);

  return {
    isConnected,
    connectionStatus,
    checkConnection,
    lastMessage
  };
};

export default useWebSocket;
