import { createServer, IncomingMessage, ServerResponse } from "http";
import { Server } from "socket.io";

const PORT = parseInt(process.env.WS_PORT || "3001");

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
    return;
  }
  res.writeHead(404);
  res.end();
});
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Track connected users and their subscriptions
const userSockets = new Map<string, Set<string>>(); // userId -> Set<socketId>
const socketRooms = new Map<string, Set<string>>(); // socketId -> Set<marketId>

io.on("connection", (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // User authentication
  socket.on("authenticate", (data: { userId: string }) => {
    const { userId } = data;
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);
    socket.data.userId = userId;
    console.log(`[WS] User ${userId} authenticated`);
  });

  // Subscribe to a race/market for live odds updates
  socket.on("subscribe-race", (data: { marketId: string }) => {
    const { marketId } = data;
    socket.join(`market:${marketId}`);
    if (!socketRooms.has(socket.id)) {
      socketRooms.set(socket.id, new Set());
    }
    socketRooms.get(socket.id)!.add(marketId);
    console.log(`[WS] ${socket.id} subscribed to market ${marketId}`);
  });

  // Unsubscribe from a race
  socket.on("unsubscribe-race", (data: { marketId: string }) => {
    const { marketId } = data;
    socket.leave(`market:${marketId}`);
    socketRooms.get(socket.id)?.delete(marketId);
  });

  // Join race chat room
  socket.on("join-chat", (data: { raceId: string }) => {
    socket.join(`chat:${data.raceId}`);
  });

  // Leave race chat room
  socket.on("leave-chat", (data: { raceId: string }) => {
    socket.leave(`chat:${data.raceId}`);
  });

  // Send chat message
  socket.on("send-chat-message", (data: { raceId: string; message: string; userName: string; userImage?: string }) => {
    io.to(`chat:${data.raceId}`).emit("chat-message", {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      userId: socket.data.userId,
      userName: data.userName,
      userImage: data.userImage,
      message: data.message,
      raceId: data.raceId,
      timestamp: new Date().toISOString(),
    });
  });

  // Cleanup on disconnect
  socket.on("disconnect", () => {
    const userId = socket.data.userId;
    if (userId) {
      userSockets.get(userId)?.delete(socket.id);
      if (userSockets.get(userId)?.size === 0) {
        userSockets.delete(userId);
      }
    }
    socketRooms.delete(socket.id);
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// Functions to broadcast events from workers
export function broadcastOddsUpdate(marketId: string, data: unknown) {
  io.to(`market:${marketId}`).emit("odds-update", data);
}

export function broadcastWhaleAlert(data: unknown) {
  io.emit("whale-alert", data);
}

export function broadcastFluctuationAlert(data: unknown) {
  io.emit("fluctuation-alert", data);
}

export function broadcastRaceStatus(data: unknown) {
  io.emit("race-status", data);
}

export function sendAlertToUser(userId: string, data: unknown) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    for (const socketId of sockets) {
      io.to(socketId).emit("alert", data);
    }
  }
}

httpServer.listen(PORT, () => {
  console.log(`[WS] WebSocket server running on port ${PORT}`);
});
