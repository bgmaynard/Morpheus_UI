/**
 * Morpheus Event Types
 *
 * Type definitions matching Morpheus_AI event schema.
 * UI subscribes to these events via WebSocket.
 */

// All Morpheus event types
export type EventType =
  // Market Data
  | 'MARKET_SNAPSHOT'
  | 'QUOTE_UPDATE'
  | 'CANDLE_UPDATE'
  // Features & Regime
  | 'FEATURES_COMPUTED'
  | 'REGIME_DETECTED'
  // Strategy Signals
  | 'SIGNAL_CANDIDATE'
  | 'SIGNAL_SCORED'
  // Meta Gate
  | 'META_APPROVED'
  | 'META_REJECTED'
  // Risk
  | 'RISK_VETO'
  | 'RISK_APPROVED'
  // Human Confirmation
  | 'HUMAN_CONFIRM_ACCEPTED'
  | 'HUMAN_CONFIRM_REJECTED'
  // Execution
  | 'EXECUTION_BLOCKED'
  | 'ORDER_SUBMITTED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_REJECTED'
  | 'ORDER_CANCELLED'
  | 'ORDER_FILL_RECEIVED'
  | 'ORDER_STATUS_UNKNOWN'
  // Trade Lifecycle (FSM)
  | 'TRADE_INITIATED'
  | 'TRADE_ENTRY_PENDING'
  | 'TRADE_ENTRY_FILLED'
  | 'TRADE_ACTIVE'
  | 'TRADE_EXIT_PENDING'
  | 'TRADE_CLOSED'
  | 'TRADE_CANCELLED'
  | 'TRADE_ERROR'
  // System
  | 'SYSTEM_START'
  | 'SYSTEM_STOP'
  | 'HEARTBEAT';

// Base Morpheus event structure
export interface MorpheusEvent {
  event_id: string;
  event_type: EventType;
  timestamp: string;
  payload: Record<string, unknown>;
  trade_id?: string;
  symbol?: string;
  correlation_id?: string;
}

// Decision chain for a symbol (UI tracks this)
export interface DecisionChain {
  symbol: string;

  // Latest regime detection
  regime?: {
    regime: string; // e.g., 'trending', 'mean_reverting', 'volatile', 'quiet'
    confidence: number;
    timestamp: string;
  };

  // Latest signal candidate
  signal?: {
    direction: 'long' | 'short' | 'none';
    strategy_name: string;
    entry_price?: number;
    stop_price?: number;
    target_price?: number;
    timestamp: string;
  };

  // Latest score
  score?: {
    confidence: number;
    rationale: string;
    model_name: string;
    timestamp: string;
  };

  // Latest gate decision
  gate?: {
    decision: 'approved' | 'rejected' | 'pending';
    reasons: string[];
    timestamp: string;
  };

  // Latest risk decision
  risk?: {
    decision: 'approved' | 'vetoed';
    veto_reasons: string[];
    position_size?: {
      shares: number;
      notional_value: string;
    };
    timestamp: string;
  };

  // Latest guard check
  guard?: {
    decision: 'execute' | 'block';
    block_reasons: string[];
    spread_pct: number;
    timestamp: string;
  };

  // Latest order status
  order?: {
    status: string;
    client_order_id: string;
    filled_quantity: number;
    timestamp: string;
  };
}

// Event category for filtering/display
export const EVENT_CATEGORIES: Record<EventType, string> = {
  MARKET_SNAPSHOT: 'Market',
  QUOTE_UPDATE: 'Market',
  CANDLE_UPDATE: 'Market',
  FEATURES_COMPUTED: 'Features',
  REGIME_DETECTED: 'Regime',
  SIGNAL_CANDIDATE: 'Signal',
  SIGNAL_SCORED: 'Score',
  META_APPROVED: 'Gate',
  META_REJECTED: 'Gate',
  RISK_VETO: 'Risk',
  RISK_APPROVED: 'Risk',
  HUMAN_CONFIRM_ACCEPTED: 'Confirm',
  HUMAN_CONFIRM_REJECTED: 'Confirm',
  EXECUTION_BLOCKED: 'Execution',
  ORDER_SUBMITTED: 'Order',
  ORDER_CONFIRMED: 'Order',
  ORDER_REJECTED: 'Order',
  ORDER_CANCELLED: 'Order',
  ORDER_FILL_RECEIVED: 'Fill',
  ORDER_STATUS_UNKNOWN: 'Order',
  TRADE_INITIATED: 'Trade',
  TRADE_ENTRY_PENDING: 'Trade',
  TRADE_ENTRY_FILLED: 'Trade',
  TRADE_ACTIVE: 'Trade',
  TRADE_EXIT_PENDING: 'Trade',
  TRADE_CLOSED: 'Trade',
  TRADE_CANCELLED: 'Trade',
  TRADE_ERROR: 'Trade',
  SYSTEM_START: 'System',
  SYSTEM_STOP: 'System',
  HEARTBEAT: 'System',
};

// Event colors for display
export const EVENT_COLORS: Record<string, string> = {
  Market: '#3498db',
  Features: '#9b59b6',
  Regime: '#9b59b6',
  Signal: '#f39c12',
  Score: '#f39c12',
  Gate: '#2ecc71',
  Risk: '#e74c3c',
  Confirm: '#00d26a',
  Execution: '#e67e22',
  Order: '#1abc9c',
  Fill: '#2ecc71',
  Trade: '#3498db',
  System: '#95a5a6',
};

// Type guards
export function isMorpheusEvent(data: unknown): data is MorpheusEvent {
  if (typeof data !== 'object' || data === null) return false;
  const event = data as Record<string, unknown>;
  return (
    typeof event.event_id === 'string' &&
    typeof event.event_type === 'string' &&
    typeof event.timestamp === 'string' &&
    typeof event.payload === 'object'
  );
}

// Parse event from JSON
export function parseEvent(json: string): MorpheusEvent | null {
  try {
    const data = JSON.parse(json);
    if (isMorpheusEvent(data)) {
      return data;
    }
    console.warn('Invalid event format:', data);
    return null;
  } catch (e) {
    console.error('Failed to parse event:', e);
    return null;
  }
}
