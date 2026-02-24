"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

export function useWebSocket(userId?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;

    if (!s.connected) {
      s.connect();
    }

    s.on("connect", () => {
      setIsConnected(true);
      if (userId) {
        s.emit("authenticate", { userId });
      }
    });

    s.on("disconnect", () => {
      setIsConnected(false);
    });

    return () => {
      s.off("connect");
      s.off("disconnect");
    };
  }, [userId]);

  const subscribeToRace = useCallback((marketId: string) => {
    socketRef.current?.emit("subscribe-race", { marketId });
  }, []);

  const unsubscribeFromRace = useCallback((marketId: string) => {
    socketRef.current?.emit("unsubscribe-race", { marketId });
  }, []);

  const joinChat = useCallback((raceId: string) => {
    socketRef.current?.emit("join-chat", { raceId });
  }, []);

  const leaveChat = useCallback((raceId: string) => {
    socketRef.current?.emit("leave-chat", { raceId });
  }, []);

  const sendChatMessage = useCallback(
    (raceId: string, message: string, userName: string, userImage?: string) => {
      socketRef.current?.emit("send-chat-message", {
        raceId,
        message,
        userName,
        userImage,
      });
    },
    []
  );

  const on = useCallback((event: string, callback: (...args: unknown[]) => void) => {
    socketRef.current?.on(event, callback);
    return () => {
      socketRef.current?.off(event, callback);
    };
  }, []);

  const off = useCallback((event: string, callback?: (...args: unknown[]) => void) => {
    socketRef.current?.off(event, callback);
  }, []);

  return {
    isConnected,
    subscribeToRace,
    unsubscribeFromRace,
    joinChat,
    leaveChat,
    sendChatMessage,
    on,
    off,
  };
}
