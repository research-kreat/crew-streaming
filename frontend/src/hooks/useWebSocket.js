import { useEffect, useRef, useState, useCallback } from 'react';

const useWebSocket = (url) => {
  const [readyState, setReadyState] = useState({ connected: false });
  const [lastMessage, setLastMessage] = useState(null);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const [socketUrl] = useState(url); // Fixed URL, won't change during component lifecycle

  const connectWebSocket = useCallback(() => {
    // Close existing socket if there is one
    if (socketRef.current) {
      socketRef.current.close();
    }

    // Create new WebSocket connection
    const socket = new WebSocket(socketUrl);

    // Set up event handlers
    socket.onopen = () => {
      console.log('WebSocket connected');
      setReadyState({ connected: true });
      
      // Clear any reconnect timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    socket.onclose = (event) => {
      console.log('WebSocket closed', event);
      setReadyState({ connected: false });
      
      // Attempt to reconnect after delay
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 3000);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onmessage = (event) => {
      setLastMessage(event);
    };

    socketRef.current = socket;
  }, [socketUrl]);

  // Connect on mount, reconnect on URL change
  useEffect(() => {
    connectWebSocket();
    
    // Cleanup function
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket]);

  // Function to send messages through the WebSocket
  const sendMessage = useCallback((message) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(message);
      return true;
    }
    return false;
  }, []);

  return {
    sendMessage,
    lastMessage,
    readyState,
    connected: readyState.connected
  };
};

export default useWebSocket;