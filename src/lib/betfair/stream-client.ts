import { EventEmitter } from "events";
import * as tls from "tls";

// ===== Types =====

interface StreamMessage {
  op: string;
  id?: number;
  [key: string]: unknown;
}

interface AuthMessage {
  op: "authentication";
  appKey: string;
  session: string;
}

interface MarketSubscriptionMessage {
  op: "marketSubscription";
  id: number;
  marketFilter: {
    marketIds?: string[];
    eventTypeIds?: string[];
    bettingTypes?: string[];
  };
  marketDataFilter: {
    fields: string[];
    ladderLevels?: number;
  };
  conflateMs?: number;
  initialClk?: string;
  clk?: string;
}

export interface PriceSize {
  price: number;
  size: number;
}

export interface RunnerChange {
  id: number; // selectionId
  atb?: number[][]; // available to back [price, size]
  atl?: number[][]; // available to lay [price, size]
  trd?: number[][]; // traded volume [price, size]
  ltp?: number; // last traded price
  tv?: number; // total volume (runner level)
  spn?: number; // starting price near
  spf?: number; // starting price far
  batb?: number[][]; // best available to back (position, price, size)
  batl?: number[][]; // best available to lay
  hc?: number; // handicap
  status?: string; // ACTIVE, WINNER, LOSER, PLACED, REMOVED
}

export interface MarketChange {
  id: string; // marketId
  rc?: RunnerChange[]; // runner changes
  img?: boolean; // is image (full snapshot vs delta)
  tv?: number; // total market volume
  marketDefinition?: {
    status?: string; // OPEN, SUSPENDED, CLOSED, INACTIVE
    inPlay?: boolean;
    bspReconciled?: boolean;
    complete?: boolean;
    runners?: Array<{
      id: number;
      status?: string;
      sortPriority?: number;
      name?: string;
    }>;
    eventId?: string;
    venue?: string;
    openDate?: string;
  };
  con?: boolean; // conflated - multiple updates merged
}

interface MarketChangeMessage {
  op: "mcm";
  id?: number;
  ct?: string; // change type: "SUB_IMAGE" | "RESUB_DELTA" | "HEARTBEAT"
  clk?: string; // clock token for resubscription
  initialClk?: string;
  pt: number; // publish time (epoch ms)
  mc?: MarketChange[];
  conflateMs?: number;
  heartbeatMs?: number;
  status?: number; // 503 = service unavailable
}

interface ConnectionMessage {
  op: "connection";
  connectionId: string;
}

interface StatusMessage {
  op: "status";
  id?: number;
  statusCode: string; // SUCCESS, FAILURE
  connectionClosed: boolean;
  errorCode?: string;
  errorMessage?: string;
}

// ===== Runner State =====

export interface RunnerState {
  selectionId: number;
  backPrices: PriceSize[]; // best available to back
  layPrices: PriceSize[]; // best available to lay
  tradedVolume: PriceSize[]; // all trades
  lastTradedPrice: number;
  totalVolume: number; // runner-level matched volume
  status: string;
}

export interface MarketState {
  marketId: string;
  status: string;
  inPlay: boolean;
  totalVolume: number;
  runners: Map<number, RunnerState>;
  lastUpdate: number;
  clk?: string;
  initialClk?: string;
}

// ===== Stream Client =====

const STREAM_HOST = "stream-api.betfair.com";
const STREAM_PORT = 443;
const HEARTBEAT_TIMEOUT_MS = 30_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const DEFAULT_CONFLATE_MS = 500;

export class BetfairStreamClient extends EventEmitter {
  private socket: tls.TLSSocket | null = null;
  private buffer = "";
  private messageId = 0;
  private appKey = "";
  private sessionToken = "";
  private subscribedMarketIds: string[] = [];
  private marketStates = new Map<string, MarketState>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isConnected = false;
  private isAuthenticated = false;
  private isShuttingDown = false;
  private conflateMs: number;
  private clk?: string;
  private initialClk?: string;

  constructor(conflateMs: number = DEFAULT_CONFLATE_MS) {
    super();
    this.conflateMs = conflateMs;
  }

  // ===== Public API =====

  async connect(sessionToken: string, appKey: string): Promise<void> {
    this.sessionToken = sessionToken;
    this.appKey = appKey;
    this.isShuttingDown = false;

    return new Promise((resolve, reject) => {
      try {
        this.socket = tls.connect(
          {
            host: STREAM_HOST,
            port: STREAM_PORT,
            rejectUnauthorized: true,
          },
          () => {
            console.log(`[Stream] Connected to ${STREAM_HOST}:${STREAM_PORT}`);
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.resetHeartbeatTimer();
            // Wait for connection message from server before resolving
          }
        );

        this.socket.setEncoding("utf8");

        let resolved = false;
        const resolveOnce = () => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        };

        this.socket.on("data", (data: string) => {
          this.buffer += data;
          this.processBuffer();
          // Resolve after first data received (connection message)
          resolveOnce();
        });

        this.socket.on("error", (error) => {
          console.error("[Stream] Socket error:", error.message);
          this.emit("error", error);
          if (!resolved) {
            resolved = true;
            reject(error);
          }
        });

        this.socket.on("close", () => {
          console.log("[Stream] Socket closed");
          this.isConnected = false;
          this.isAuthenticated = false;
          this.clearHeartbeatTimer();
          this.emit("disconnected");

          if (!this.isShuttingDown) {
            this.scheduleReconnect();
          }
        });

        this.socket.on("end", () => {
          console.log("[Stream] Socket ended");
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  subscribe(marketIds: string[]): void {
    if (!this.isAuthenticated) {
      console.warn("[Stream] Cannot subscribe - not authenticated yet");
      // Store for after auth
      this.subscribedMarketIds = [
        ...new Set([...this.subscribedMarketIds, ...marketIds]),
      ];
      return;
    }

    const newIds = marketIds.filter(
      (id) => !this.subscribedMarketIds.includes(id)
    );
    if (newIds.length === 0) return;

    this.subscribedMarketIds = [
      ...new Set([...this.subscribedMarketIds, ...newIds]),
    ];

    const msg: MarketSubscriptionMessage = {
      op: "marketSubscription",
      id: ++this.messageId,
      marketFilter: {
        marketIds: this.subscribedMarketIds,
      },
      marketDataFilter: {
        fields: [
          "EX_BEST_OFFERS_DISP",
          "EX_TRADED",
          "EX_MARKET_DEF",
          "EX_TRADED_VOL",
        ],
        ladderLevels: 3,
      },
      conflateMs: this.conflateMs,
    };

    // Use clk tokens for resubscription to avoid re-sending full image
    if (this.clk) {
      msg.clk = this.clk;
    }
    if (this.initialClk) {
      msg.initialClk = this.initialClk;
    }

    this.sendMessage(msg);
    console.log(
      `[Stream] Subscribed to ${this.subscribedMarketIds.length} markets (${newIds.length} new)`
    );
  }

  unsubscribe(marketIds: string[]): void {
    this.subscribedMarketIds = this.subscribedMarketIds.filter(
      (id) => !marketIds.includes(id)
    );

    // Remove from state cache
    for (const id of marketIds) {
      this.marketStates.delete(id);
    }

    // Resubscribe with remaining markets (Betfair replaces previous subscription)
    if (this.subscribedMarketIds.length > 0 && this.isAuthenticated) {
      const msg: MarketSubscriptionMessage = {
        op: "marketSubscription",
        id: ++this.messageId,
        marketFilter: {
          marketIds: this.subscribedMarketIds,
        },
        marketDataFilter: {
          fields: [
            "EX_BEST_OFFERS_DISP",
            "EX_TRADED",
            "EX_MARKET_DEF",
            "EX_TRADED_VOL",
          ],
          ladderLevels: 3,
        },
        conflateMs: this.conflateMs,
      };
      this.sendMessage(msg);
    }

    console.log(
      `[Stream] Unsubscribed ${marketIds.length} markets, ${this.subscribedMarketIds.length} remaining`
    );
  }

  disconnect(): void {
    this.isShuttingDown = true;
    this.clearHeartbeatTimer();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.isConnected = false;
    this.isAuthenticated = false;
    console.log("[Stream] Disconnected");
  }

  getMarketState(marketId: string): MarketState | undefined {
    return this.marketStates.get(marketId);
  }

  getAllMarketStates(): Map<string, MarketState> {
    return this.marketStates;
  }

  getSubscribedMarketIds(): string[] {
    return [...this.subscribedMarketIds];
  }

  get connected(): boolean {
    return this.isConnected && this.isAuthenticated;
  }

  // ===== Private Methods =====

  private sendMessage(msg: StreamMessage | MarketSubscriptionMessage | AuthMessage): void {
    if (!this.socket || !this.isConnected) {
      console.warn("[Stream] Cannot send - not connected");
      return;
    }
    const json = JSON.stringify(msg) + "\r\n";
    this.socket.write(json);
  }

  private authenticate(): void {
    const msg: AuthMessage = {
      op: "authentication",
      appKey: this.appKey,
      session: this.sessionToken,
    };
    this.sendMessage(msg);
    console.log("[Stream] Sent authentication");
  }

  private processBuffer(): void {
    // Messages are separated by \r\n
    const lines = this.buffer.split("\r\n");

    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line) as StreamMessage;
        this.handleMessage(msg);
      } catch (e) {
        console.error("[Stream] Failed to parse message:", line.slice(0, 200));
      }
    }
  }

  private handleMessage(msg: StreamMessage): void {
    this.resetHeartbeatTimer();

    switch (msg.op) {
      case "connection":
        this.handleConnection(msg as unknown as ConnectionMessage);
        break;
      case "status":
        this.handleStatus(msg as unknown as StatusMessage);
        break;
      case "mcm":
        this.handleMarketChange(msg as unknown as MarketChangeMessage);
        break;
      default:
        console.log(`[Stream] Unknown op: ${msg.op}`);
    }
  }

  private handleConnection(msg: ConnectionMessage): void {
    console.log(`[Stream] Connected, connectionId: ${msg.connectionId}`);
    this.emit("connected", msg.connectionId);

    // Authenticate immediately after connection
    this.authenticate();
  }

  private handleStatus(msg: StatusMessage): void {
    if (msg.statusCode === "SUCCESS") {
      if (!this.isAuthenticated) {
        this.isAuthenticated = true;
        console.log("[Stream] Authenticated successfully");
        this.emit("authenticated");

        // Subscribe to any pending markets
        if (this.subscribedMarketIds.length > 0) {
          const ids = [...this.subscribedMarketIds];
          this.subscribedMarketIds = []; // Clear so subscribe() treats them as new
          this.subscribe(ids);
        }
      }
    } else {
      console.error(
        `[Stream] Status error: ${msg.errorCode} - ${msg.errorMessage}`
      );
      this.emit("error", new Error(`${msg.errorCode}: ${msg.errorMessage}`));

      if (msg.connectionClosed) {
        this.isConnected = false;
        this.isAuthenticated = false;
      }
    }
  }

  private handleMarketChange(msg: MarketChangeMessage): void {
    // Store clock tokens for resubscription
    if (msg.clk) this.clk = msg.clk;
    if (msg.initialClk) this.initialClk = msg.initialClk;

    // Heartbeat with no market changes
    if (msg.ct === "HEARTBEAT" || !msg.mc) {
      return;
    }

    for (const mc of msg.mc) {
      this.applyMarketChange(mc, msg.pt);
    }
  }

  private applyMarketChange(mc: MarketChange, publishTime: number): void {
    let state = this.marketStates.get(mc.id);

    // Create new state if image or first time
    if (!state || mc.img) {
      state = {
        marketId: mc.id,
        status: "OPEN",
        inPlay: false,
        totalVolume: 0,
        runners: new Map(),
        lastUpdate: publishTime,
      };
      this.marketStates.set(mc.id, state);
    }

    state.lastUpdate = publishTime;

    // Apply market definition changes
    if (mc.marketDefinition) {
      if (mc.marketDefinition.status) {
        const oldStatus = state.status;
        state.status = mc.marketDefinition.status;
        if (oldStatus !== state.status) {
          this.emit("statusChange", {
            marketId: mc.id,
            oldStatus,
            newStatus: state.status,
            inPlay: mc.marketDefinition.inPlay ?? state.inPlay,
          });
        }
      }
      if (mc.marketDefinition.inPlay !== undefined) {
        state.inPlay = mc.marketDefinition.inPlay;
      }

      // Initialize runners from market definition
      if (mc.marketDefinition.runners) {
        for (const r of mc.marketDefinition.runners) {
          if (!state.runners.has(r.id)) {
            state.runners.set(r.id, {
              selectionId: r.id,
              backPrices: [],
              layPrices: [],
              tradedVolume: [],
              lastTradedPrice: 0,
              totalVolume: 0,
              status: r.status || "ACTIVE",
            });
          } else if (r.status) {
            state.runners.get(r.id)!.status = r.status;
          }
        }
      }
    }

    // Apply total volume
    if (mc.tv !== undefined) {
      state.totalVolume = mc.tv;
    }

    // Apply runner changes
    if (mc.rc) {
      for (const rc of mc.rc) {
        let runner = state.runners.get(rc.id);
        if (!runner) {
          runner = {
            selectionId: rc.id,
            backPrices: [],
            layPrices: [],
            tradedVolume: [],
            lastTradedPrice: 0,
            totalVolume: 0,
            status: "ACTIVE",
          };
          state.runners.set(rc.id, runner);
        }

        // Apply best available to back
        if (rc.batb) {
          for (const [_pos, price, size] of rc.batb) {
            this.updatePriceLevel(runner.backPrices, price, size);
          }
        } else if (rc.atb) {
          for (const [price, size] of rc.atb) {
            this.updatePriceLevel(runner.backPrices, price, size);
          }
        }

        // Apply best available to lay
        if (rc.batl) {
          for (const [_pos, price, size] of rc.batl) {
            this.updatePriceLevel(runner.layPrices, price, size);
          }
        } else if (rc.atl) {
          for (const [price, size] of rc.atl) {
            this.updatePriceLevel(runner.layPrices, price, size);
          }
        }

        // Apply traded volume
        if (rc.trd) {
          for (const [price, size] of rc.trd) {
            this.updatePriceLevel(runner.tradedVolume, price, size);
          }
        }

        // Last traded price
        if (rc.ltp !== undefined) {
          runner.lastTradedPrice = rc.ltp;
        }

        // Runner total volume
        if (rc.tv !== undefined) {
          runner.totalVolume = rc.tv;
        }

        // Runner status
        if (rc.status) {
          runner.status = rc.status;
        }
      }
    }

    // Emit market change event
    this.emit("marketChange", state, mc);
  }

  private updatePriceLevel(
    levels: PriceSize[],
    price: number,
    size: number
  ): void {
    const idx = levels.findIndex((l) => l.price === price);
    if (size === 0) {
      // Remove price level
      if (idx >= 0) levels.splice(idx, 1);
    } else if (idx >= 0) {
      levels[idx].size = size;
    } else {
      levels.push({ price, size });
      // Sort: back prices descending, lay prices ascending
      levels.sort((a, b) => b.price - a.price);
    }
  }

  private resetHeartbeatTimer(): void {
    this.clearHeartbeatTimer();
    this.heartbeatTimer = setTimeout(() => {
      console.warn("[Stream] Heartbeat timeout - connection may be dead");
      this.emit("error", new Error("Heartbeat timeout"));
      // Force reconnect
      if (this.socket) {
        this.socket.destroy();
      }
    }, HEARTBEAT_TIMEOUT_MS);
  }

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.isShuttingDown) return;

    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempts),
      RECONNECT_MAX_MS
    );
    this.reconnectAttempts++;

    console.log(
      `[Stream] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect(this.sessionToken, this.appKey);
      } catch (error) {
        console.error("[Stream] Reconnect failed:", error);
        // Will retry via the close handler
      }
    }, delay);
  }
}
