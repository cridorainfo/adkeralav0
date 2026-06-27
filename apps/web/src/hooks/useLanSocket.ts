/**
 * useLanSocket — WebSocket to the display device on the bus LAN
 * Connects to ws://adkerala-display.local:8766 (mDNS)
 *
 * Falls back gracefully if the display is not reachable (internet-only mode).
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { LanMessage, GpsPoint } from '@adkerala/types';

const LAN_URL = 'ws://adkerala-display.local:8766';
const RETRY_INTERVAL_MS = 3_000;

interface Options {
  enabled:   boolean;
  busId:     string;
  sessionId: string;
}

export function useLanSocket({ enabled, busId, sessionId }: Options) {
  const ws              = useRef<WebSocket | null>(null);
  const retryTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = () => {
    if (!enabled) return;
    try {
      const socket = new WebSocket(LAN_URL);
      ws.current = socket;

      socket.onopen = () => {
        setConnected(true);
        retryTimer.current && clearTimeout(retryTimer.current);
        // Send session context so display knows which session this is
        send({ type: 'session', sessionId, ts: Date.now() });
        console.log('[LAN] connected to display');
      };

      socket.onclose = () => {
        setConnected(false);
        ws.current = null;
        retryTimer.current = setTimeout(connect, RETRY_INTERVAL_MS);
      };

      socket.onerror = () => socket.close();
    } catch {
      retryTimer.current = setTimeout(connect, RETRY_INTERVAL_MS);
    }
  };

  useEffect(() => {
    if (enabled) connect();
    return () => {
      retryTimer.current && clearTimeout(retryTimer.current);
      ws.current?.close();
    };
  }, [enabled]);

  const send = (msg: LanMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    }
  };

  const pushGps = (point: GpsPoint) => {
    send({ type: 'gps', point, ts: Date.now() });
  };

  const sendButton = (button: 'forward' | 'undo' | 'announce') => {
    send({ type: 'btn', button, ts: Date.now() });
  };

  return { connected, pushGps, sendButton };
}
