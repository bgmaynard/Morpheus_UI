/**
 * Morpheus REST API Client
 *
 * Sends commands to Morpheus_AI.
 * UI sends requests, Morpheus decides and emits events.
 *
 * Every command includes:
 * - command_id: UUID for correlation with response events
 * - timestamp: ISO-8601 for audit/replay
 */

export interface APIConfig {
  baseUrl: string;
  timeout: number;
}

const DEFAULT_CONFIG: APIConfig = {
  baseUrl: 'http://localhost:8010',
  timeout: 10000,
};

// Command types
export type CommandType =
  | 'SET_SYMBOL_CHAIN'
  | 'SUBSCRIBE_SYMBOL'
  | 'UNSUBSCRIBE_SYMBOL'
  | 'SUBMIT_MANUAL_ORDER'
  | 'CANCEL_ORDER'
  | 'CANCEL_ALL'
  | 'SET_PROFILE'
  | 'ARM_LIVE_TRADING'
  | 'DISARM_LIVE_TRADING'
  | 'ACTIVATE_KILL_SWITCH'
  | 'DEACTIVATE_KILL_SWITCH'
  | 'CONFIRM_ENTRY';

// Command envelope - every command must have this structure
export interface Command {
  command_id: string;
  command_type: CommandType;
  payload: Record<string, unknown>;
  timestamp: string;
}

// Command result - UI should not rely on this for state changes
// State changes come via events only
export interface CommandResult {
  accepted: boolean;
  command_id: string;
  message?: string;
}

export interface ManualOrderPayload {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  order_type: 'market' | 'limit' | 'stop' | 'stop_limit';
  limit_price?: number;
  stop_price?: number;
  time_in_force?: string;
}

export interface ProfilePayload {
  gate: 'standard' | 'permissive' | 'strict';
  risk: 'standard' | 'permissive' | 'strict';
  guard: 'standard' | 'permissive' | 'strict';
}

// CONFIRM_ENTRY payload - human confirms tape-synchronized entry
export interface ConfirmEntryPayload {
  symbol: string;
  chain_id: number;
  signal_timestamp: string;  // ISO-8601 timestamp of the signal being confirmed
  entry_price: number;       // Price at time of confirmation
}

// Generate UUID v4
function generateCommandId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class MorpheusAPIClient {
  private config: APIConfig;
  private pendingCommands: Map<string, { type: CommandType; timestamp: number }> = new Map();

  constructor(config: Partial<APIConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API Error ${response.status}: ${error}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  // Create command envelope with ID and timestamp
  private createCommand(type: CommandType, payload: Record<string, unknown>): Command {
    const commandId = generateCommandId();
    const command: Command = {
      command_id: commandId,
      command_type: type,
      payload,
      timestamp: new Date().toISOString(),
    };

    // Track pending command for correlation
    this.pendingCommands.set(commandId, {
      type,
      timestamp: Date.now(),
    });

    // Clean up old pending commands (> 60 seconds)
    this.cleanupPendingCommands();

    return command;
  }

  private cleanupPendingCommands(): void {
    const now = Date.now();
    const maxAge = 60000; // 60 seconds

    for (const [id, cmd] of this.pendingCommands.entries()) {
      if (now - cmd.timestamp > maxAge) {
        this.pendingCommands.delete(id);
      }
    }
  }

  // Check if a command_id is pending (for UI feedback)
  isPending(commandId: string): boolean {
    return this.pendingCommands.has(commandId);
  }

  // Mark command as resolved (called when event received)
  resolveCommand(commandId: string): void {
    this.pendingCommands.delete(commandId);
  }

  // Get all pending command IDs
  getPendingCommands(): string[] {
    return Array.from(this.pendingCommands.keys());
  }

  // Send a command to Morpheus
  async sendCommand(type: CommandType, payload: Record<string, unknown>): Promise<CommandResult> {
    const command = this.createCommand(type, payload);

    try {
      const result = await this.request<CommandResult>('/api/ui/command', {
        method: 'POST',
        body: JSON.stringify(command),
      });

      return {
        ...result,
        command_id: command.command_id,
      };
    } catch (error) {
      // Remove from pending on error
      this.pendingCommands.delete(command.command_id);
      throw error;
    }
  }

  // Get current state (for reconnect/initialization)
  async getState(): Promise<Record<string, unknown>> {
    return this.request('/api/ui/state');
  }

  // Convenience methods - all return command_id for correlation

  async submitManualOrder(order: ManualOrderPayload): Promise<CommandResult> {
    return this.sendCommand('SUBMIT_MANUAL_ORDER', order);
  }

  async cancelOrder(clientOrderId: string): Promise<CommandResult> {
    return this.sendCommand('CANCEL_ORDER', { client_order_id: clientOrderId });
  }

  async cancelAllOrders(): Promise<CommandResult> {
    return this.sendCommand('CANCEL_ALL', {});
  }

  async setProfile(profile: ProfilePayload): Promise<CommandResult> {
    return this.sendCommand('SET_PROFILE', profile);
  }

  async armLiveTrading(confirmationCode: string): Promise<CommandResult> {
    return this.sendCommand('ARM_LIVE_TRADING', { confirmation: confirmationCode });
  }

  async disarmLiveTrading(): Promise<CommandResult> {
    return this.sendCommand('DISARM_LIVE_TRADING', {});
  }

  async activateKillSwitch(): Promise<CommandResult> {
    return this.sendCommand('ACTIVATE_KILL_SWITCH', {});
  }

  async deactivateKillSwitch(): Promise<CommandResult> {
    return this.sendCommand('DEACTIVATE_KILL_SWITCH', {});
  }

  // Human confirmation of tape-synchronized entry
  async confirmEntry(payload: ConfirmEntryPayload): Promise<CommandResult> {
    return this.sendCommand('CONFIRM_ENTRY', payload);
  }

  // Subscribe to live quote updates for a symbol
  async subscribeSymbol(symbol: string): Promise<CommandResult> {
    return this.sendCommand('SUBSCRIBE_SYMBOL', { symbol: symbol.toUpperCase() });
  }

  // Unsubscribe from live quote updates
  async unsubscribeSymbol(symbol: string): Promise<CommandResult> {
    return this.sendCommand('UNSUBSCRIBE_SYMBOL', { symbol: symbol.toUpperCase() });
  }

  // ========================================================================
  // Market Data Methods (read-only, no commands)
  // ========================================================================

  // Check if market data is available
  async getMarketStatus(): Promise<MarketStatus> {
    return this.request('/api/market/status');
  }

  // Get current quote for a symbol
  async getQuote(symbol: string): Promise<QuoteResponse> {
    return this.request(`/api/market/quote/${symbol.toUpperCase()}`);
  }

  // Get quotes for multiple symbols
  async getQuotes(symbols: string[]): Promise<QuotesResponse> {
    return this.request(`/api/market/quotes?symbols=${symbols.join(',')}`);
  }

  // Get candles for charting
  async getCandles(
    symbol: string,
    periodType: string = 'day',
    period: number = 1,
    frequency: number = 1,
    frequencyType: string = 'minute',
  ): Promise<CandlesResponse> {
    const params = new URLSearchParams({
      period_type: periodType,
      period: period.toString(),
      frequency: frequency.toString(),
      frequency_type: frequencyType,
    });
    return this.request(`/api/market/candles/${symbol.toUpperCase()}?${params}`);
  }

  // ========================================================================
  // Trading Data Methods (Positions, Orders, Transactions)
  // ========================================================================

  // Get current account positions
  async getPositions(): Promise<PositionsResponse> {
    return this.request('/api/trading/positions');
  }

  // Get orders (optionally filtered by status)
  async getOrders(status?: string): Promise<OrdersResponse> {
    const params = status ? `?status=${status}` : '';
    return this.request(`/api/trading/orders${params}`);
  }

  // Get today's transactions/executions
  async getTransactions(): Promise<TransactionsResponse> {
    return this.request('/api/trading/transactions');
  }

  // ========================================================================
  // Stats Methods (Dashboard data)
  // ========================================================================

  // Get today's stats summary
  async getTodayStats(): Promise<TodayStatsResponse> {
    return this.request('/api/stats/today');
  }

  // Get rejection reasons breakdown
  async getRejections(date?: string): Promise<RejectionsResponse> {
    const params = date ? `?date=${date}` : '';
    return this.request(`/api/stats/rejections${params}`);
  }

  // Get recent trades
  async getTrades(limit?: number): Promise<TradesResponse> {
    const params = limit ? `?limit=${limit}` : '';
    return this.request(`/api/stats/trades${params}`);
  }

  // Get scanner status
  async getScannerStatus(): Promise<ScannerStatusResponse> {
    return this.request('/api/scanner/status');
  }

  // Get scanner watchlist
  async getScannerWatchlist(): Promise<ScannerWatchlistResponse> {
    return this.request('/api/scanner/watchlist');
  }
}

// Market data types
export interface MarketStatus {
  available: boolean;
  provider: string | null;
}

export interface QuoteResponse {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  timestamp: string;
  is_tradeable: boolean;
  is_market_open: boolean;
}

export interface QuotesResponse {
  quotes: Record<string, QuoteResponse>;
}

export interface CandleData {
  time: number;  // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandlesResponse {
  symbol: string;
  candles: CandleData[];
}

// Trading data types
export interface PositionData {
  symbol: string;
  quantity: number;
  avg_price: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  asset_type: string;
}

export interface PositionsResponse {
  positions: PositionData[];
}

export interface OrderData {
  order_id: string;
  symbol: string;
  side: string;
  quantity: number;
  filled_quantity: number;
  order_type: string;
  limit_price: number | null;
  stop_price: number | null;
  status: string;
  entered_time: string;
  close_time: string | null;
}

export interface OrdersResponse {
  orders: OrderData[];
}

export interface TransactionData {
  transaction_id: string;
  order_id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  timestamp: string;
  transaction_type: string;
  description: string;
}

export interface TransactionsResponse {
  transactions: TransactionData[];
}

// Stats data types
export interface TodayStatsResponse {
  date: string;
  signals_detected: number;
  signals_rejected: number;
  trades_total: number;
  trades_closed: number;
  trades_won: number;
  trades_lost: number;
  win_rate: number;
  total_pnl: number;
  top_rejection_reasons: Record<string, number>;
}

export interface RejectionsResponse {
  rejections: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  total: number;
}

export interface TradeData {
  trade_id: string;
  signal_id: string | null;
  symbol: string;
  direction: string;
  trade_type: string;
  status: string;
  entry_price: number | null;
  exit_price: number | null;
  entry_time: string;
  exit_time: string | null;
  shares: number | null;
  pnl: number | null;
  pnl_percent: number | null;
  exit_reason: string | null;
}

export interface TradesResponse {
  trades: TradeData[];
}

export interface ScannerStatusResponse {
  enabled: boolean;
  scanner: {
    running: boolean;
    scans_performed: number;
    candidates_found: number;
    last_scan: string | null;
    symbols_tracked: string[];
  } | null;
  watchlist: {
    active_count: number;
    symbols: string[];
  } | null;
}

export interface WatchlistItem {
  symbol: string;
  state: string;
  added_at: string;
  score: number | null;
  rvol: number | null;
  change_pct: number | null;
}

export interface ScannerWatchlistResponse {
  watchlist: WatchlistItem[];
}

// Singleton instance
let apiClientInstance: MorpheusAPIClient | null = null;

export function getAPIClient(config?: Partial<APIConfig>): MorpheusAPIClient {
  if (!apiClientInstance) {
    apiClientInstance = new MorpheusAPIClient(config);
  }
  return apiClientInstance;
}
