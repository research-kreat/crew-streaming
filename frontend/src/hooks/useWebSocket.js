import { useEffect, useRef, useState, useCallback } from 'react';

const useWebSocket = (url) => {
  const [readyState, setReadyState] = useState({ 
    connected: false, 
    connecting: true,
    error: null 
  });
  const [lastMessage, setLastMessage] = useState(null);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const BASE_RECONNECT_DELAY = 1000; // Start with 1 second
  const [socketUrl] = useState(url); // Fixed URL, won't change during component lifecycle
  
  // Function to calculate exponential backoff delay
  const getReconnectDelay = useCallback(() => {
    const attempt = reconnectAttemptsRef.current;
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    return Math.min(BASE_RECONNECT_DELAY * Math.pow(2, attempt), 30000); // Max 30 seconds
  }, []);

  const connectWebSocket = useCallback(() => {
    // Don't try to connect if URL is not valid
    if (!socketUrl) {
      setReadyState({
        connected: false,
        connecting: false,
        error: 'Invalid WebSocket URL'
      });
      return;
    }

    // Show connecting state
    setReadyState(prev => ({ ...prev, connecting: true }));
    
    // Close existing socket if there is one
    if (socketRef.current) {
      socketRef.current.close();
    }

    try {
      // Create new WebSocket connection
      const socket = new WebSocket(socketUrl);

      // Set up event handlers
      socket.onopen = () => {
        console.log('WebSocket connected successfully');
        setReadyState({ 
          connected: true, 
          connecting: false,
          error: null 
        });
        
        // Reset reconnection attempts on successful connection
        reconnectAttemptsRef.current = 0;
        
        // Clear any reconnect timeouts
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      socket.onclose = (event) => {
        const wasClean = event.wasClean;
        const code = event.code;
        const reason = event.reason;
        
        console.log(`WebSocket closed: Clean: ${wasClean}, Code: ${code}, Reason: ${reason || 'No reason provided'}`);
        
        setReadyState({
          connected: false,
          connecting: false,
          error: `Connection closed${!wasClean ? ' unexpectedly' : ''}${reason ? ': ' + reason : ''}`
        });
        
        // If we haven't reached max attempts, try to reconnect
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current += 1;
          const delay = getReconnectDelay();
          
          console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms`);
          
          // Attempt to reconnect after calculated delay
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, delay);
        } else {
          console.error('Maximum reconnection attempts reached');
          setReadyState(prev => ({
            ...prev,
            error: 'Maximum reconnection attempts reached. Please refresh the page.'
          }));
        }
      };

      socket.onerror = (error) => {
        // but we can show a more helpful message
        const errorMessage = 'WebSocket connection error. This might be due to the server being down, a network issue, or incorrect URL.';
        console.error(errorMessage, error);
        
        setReadyState(prev => ({
          ...prev,
          error: errorMessage
        }));
      };

      socket.onmessage = (event) => {
        try {
          // Try to parse the message and log it nicely for debugging
          const data = JSON.parse(event.data);
          console.debug('WebSocket received:', data);
        } catch (e) {
          // Just log the raw message if it's not JSON
          console.debug('WebSocket received non-JSON message:', event.data);
        }
        
        setLastMessage(event);
      };

      socketRef.current = socket;
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setReadyState({
        connected: false,
        connecting: false,
        error: `Failed to create WebSocket: ${error.message}`
      });
    }
  }, [socketUrl, getReconnectDelay]);

  // Manual reconnect function that users can call
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0; // Reset the counter
    connectWebSocket();
  }, [connectWebSocket]);

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
    connected: readyState.connected,
    connecting: readyState.connecting,
    error: readyState.error,
    reconnect
  };
};

export default useWebSocket;