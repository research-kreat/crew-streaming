import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const useWebSocket = (url) => {
  const [socket, setSocket] = useState(null);
  const [readyState, setReadyState] = useState({ connected: false });
  const [lastMessage, setLastMessage] = useState(null);
  const [socketUrl] = useState(url);

  useEffect(() => {
    // Parse URL to get base and path
    let baseUrl = socketUrl;
    
    // Create socket.io connection
    const socketInstance = io(baseUrl, {
      path: '/api/ws',
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
      transports: ['websocket']
    });

    // Set up event handlers
    socketInstance.on('connect', () => {
      console.log('WebSocket connected');
      setReadyState({ connected: true });
    });

    socketInstance.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setReadyState({ connected: false });
    });

    socketInstance.on('message', (data) => {
      console.log('Received message:', data);
      setLastMessage({ data: JSON.stringify(data) });
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setReadyState({ connected: false });
    });

    // Store socket instance
    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, [socketUrl]);

  // Function to send messages through the WebSocket
  const sendMessage = useCallback((message) => {
    if (socket && socket.connected) {
      console.log('Sending message:', message);
      socket.emit('message', message);
      return true;
    }
    console.warn('Cannot send message: Socket not connected');
    return false;
  }, [socket]);

  return {
    sendMessage,
    lastMessage,
    readyState,
    connected: readyState.connected
  };
};

export default useWebSocket;