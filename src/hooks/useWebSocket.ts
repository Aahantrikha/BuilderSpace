import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

export function useWebSocket() {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const messageHandlersRef = useRef<Set<(data: any) => void>>(new Set());
  const isConnectingRef = useRef(false);

  const connect = useCallback(() => {
    if (!user?.id) return;
    
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      console.log('[WebSocket] Already connecting, skipping...');
      return;
    }
    
    // Check if already connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected, skipping...');
      return;
    }
    
    // Check if currently connecting
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('[WebSocket] Connection in progress, skipping...');
      return;
    }

    isConnectingRef.current = true;

    // Automatically detect the correct WebSocket URL
    const currentHost = window.location.hostname;
    let wsBaseUrl: string;
    
    if (import.meta.env.VITE_API_URL) {
      // Use environment variable if set
      const apiUrl = import.meta.env.VITE_API_URL;
      wsBaseUrl = apiUrl.replace('/api', '').replace('http://', 'ws://').replace('https://', 'wss://');
    } else if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
      // If accessing from network, use the same host
      wsBaseUrl = `ws://${currentHost}:3001`;
    } else {
      // Default to localhost
      wsBaseUrl = 'ws://localhost:3001';
    }
    
    const wsUrl = `${wsBaseUrl}/ws?userId=${user.id}`;
    console.log('[WebSocket] Connecting to:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WebSocket] Connected successfully');
      isConnectingRef.current = false;
      
      // Start sending heartbeat messages every 20 seconds
      heartbeatIntervalRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'heartbeat' }));
          console.log('[WebSocket] Sent heartbeat');
        }
      }, 20000); // Send every 20 seconds (server expects within 60 seconds)
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WebSocket] Received message:', data);
        messageHandlersRef.current.forEach(handler => handler(data));
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Connection error:', error);
      isConnectingRef.current = false;
    };

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected, will reconnect in 3s');
      wsRef.current = null;
      isConnectingRef.current = false;
      
      // Clear heartbeat interval
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = undefined;
      }
      
      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        if (user?.id) {
          connect();
        }
      }, 3000);
    };

    wsRef.current = ws;
  }, [user?.id]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const subscribe = useCallback((handler: (data: any) => void) => {
    messageHandlersRef.current.add(handler);
    
    return () => {
      messageHandlersRef.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    if (user?.id) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [user?.id, connect, disconnect]);

  return { subscribe };
}
