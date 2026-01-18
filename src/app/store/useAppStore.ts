/**
 * Morpheus UI - Zustand Store
 *
 * Global state management for:
 * - Symbol chains (Sterling-style linking)
 * - Connection status
 * - Events from Morpheus
 * - Trading mode & controls
 * - Event-derived orders, positions, executions
 * - Profile settings
 *
 * IMPORTANT: All trading state (orders, positions, executions) is
 * derived from Morpheus events. UI never assumes state optimistically.
 */

import { create } from 'zustand';
import { GoldenLayout } from 'golden-layout';
import { MorpheusEvent, DecisionChain } from '../morpheus/eventTypes';

// Global GoldenLayout reference for panel management
let goldenLayoutInstance: GoldenLayout | null = null;

export const setGoldenLayout = (layout: GoldenLayout | null) => {
  goldenLayoutInstance = layout;
};

export const getGoldenLayout = () => goldenLayoutInstance;

// Panel definitions for the menu
export const PANEL_DEFINITIONS = [
  { type: 'chart', title: 'Chart' },
  { type: 'watchlist', title: 'Watchlist' },
  { type: 'orderEntry', title: 'Order Entry' },
  { type: 'orders', title: 'Orders' },
  { type: 'positions', title: 'Positions' },
  { type: 'executions', title: 'Executions' },
  { type: 'eventStream', title: 'Event Stream' },
  { type: 'morpheusDecision', title: 'Morpheus Decision' },
  { type: 'tradingControls', title: 'Trading Controls' },
  { type: 'decisionSupport', title: 'Decision Support' },
] as const;

export const addPanel = (componentType: string, title: string) => {
  const layout = getGoldenLayout();
  if (!layout || !layout.rootItem) return false;

  try {
    // Find a stack or row to add to
    const rootItem = layout.rootItem;

    // Create the component config
    const componentConfig = {
      type: 'component' as const,
      componentType,
      title,
    };

    // Try to add to root item - GoldenLayout will find the best spot
    if (rootItem.isRow || rootItem.isColumn) {
      // Add as a new item in the root row/column
      layout.addItem(componentConfig, rootItem as any);
    } else if (rootItem.isStack) {
      // Add as a tab in the root stack
      layout.addItem(componentConfig, rootItem as any);
    } else {
      // Fallback: use addComponent which creates at root
      layout.addComponent(componentType, undefined, title);
    }

    return true;
  } catch (e) {
    console.error('Failed to add panel:', e);
    // Fallback method
    try {
      layout.addComponent(componentType, undefined, title);
      return true;
    } catch (e2) {
      console.error('Fallback also failed:', e2);
      return false;
    }
  }
};

// Chain colors matching Sterling Trader Pro
export const CHAIN_COLORS: Record<number, string> = {
  1: '#3498db', // Blue
  2: '#e74c3c', // Red
  3: '#2ecc71', // Green
  4: '#f39c12', // Yellow
  5: '#9b59b6', // Purple
  6: '#1abc9c', // Teal
  7: '#e67e22', // Orange
  8: '#95a5a6', // Gray
};

export type Timeframe = '10s' | '1m' | '5m' | '1D';
export type ProfileLevel = 'standard' | 'permissive' | 'strict';

export interface Chain {
  id: number;
  symbol: string;
  timeframe: Timeframe;
  color: string;
}

export interface ConnectionStatus {
  websocket: 'connected' | 'disconnected' | 'connecting';
  lastEventTime: Date | null;
  eventCount: number;
}

export interface TradingState {
  mode: 'PAPER' | 'LIVE';
  liveArmed: boolean;
  killSwitchActive: boolean;
}

export interface ProfileState {
  gate: ProfileLevel;
  risk: ProfileLevel;
  guard: ProfileLevel;
}

// Event-derived order state
export interface Order {
  client_order_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  filled_quantity: number;
  order_type: string;
  limit_price?: number;
  stop_price?: number;
  status: 'pending' | 'submitted' | 'confirmed' | 'partial' | 'filled' | 'cancelled' | 'rejected';
  timestamp: string;
  command_id?: string; // For correlation with UI commands
}

// Event-derived position state
export interface Position {
  symbol: string;
  quantity: number;
  avg_price: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  last_updated: string;
}

// Event-derived execution state
export interface Execution {
  exec_id: string;
  client_order_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: string;
}

// Pending command tracking (for UI feedback)
export interface PendingCommand {
  command_id: string;
  command_type: string;
  timestamp: number;
  symbol?: string;
}

export interface AppState {
  // Chains (Sterling-style symbol linking)
  chains: Record<number, Chain>;
  activeChainId: number;

  // Connection
  connection: ConnectionStatus;

  // Events (last N events for display)
  events: MorpheusEvent[];
  maxEvents: number;

  // Decision chains per symbol (signal -> score -> gate -> risk -> guard)
  decisionChains: Record<string, DecisionChain>;

  // Trading state
  trading: TradingState;

  // Profile settings
  profile: ProfileState;

  // Event-derived trading data
  orders: Record<string, Order>;  // keyed by client_order_id
  positions: Record<string, Position>;  // keyed by symbol
  executions: Execution[];

  // Pending commands (for UI feedback)
  pendingCommands: Record<string, PendingCommand>;

  // Actions - Chain management
  setChainSymbol: (chainId: number, symbol: string) => void;
  setChainTimeframe: (chainId: number, timeframe: Timeframe) => void;
  setActiveChain: (chainId: number) => void;

  // Actions - Connection
  setConnectionStatus: (status: ConnectionStatus['websocket']) => void;
  addEvent: (event: MorpheusEvent) => void;
  clearEvents: () => void;

  // Actions - Decision chain
  updateDecisionChain: (symbol: string, chain: Partial<DecisionChain>) => void;

  // Actions - Trading controls
  setTradingMode: (mode: TradingState['mode']) => void;
  setLiveArmed: (armed: boolean) => void;
  setKillSwitchActive: (active: boolean) => void;

  // Actions - Profile
  setProfile: (profile: Partial<ProfileState>) => void;

  // Actions - Event-derived state (called by event processor)
  processOrderEvent: (event: MorpheusEvent) => void;
  processExecutionEvent: (event: MorpheusEvent) => void;
  processPositionEvent: (event: MorpheusEvent) => void;
  processSystemEvent: (event: MorpheusEvent) => void;

  // Actions - Pending commands
  addPendingCommand: (command: PendingCommand) => void;
  removePendingCommand: (commandId: string) => void;

  // Actions - State reset (for reconnect)
  resetTradingState: () => void;
  loadInitialState: (state: Record<string, unknown>) => void;
}

// Initialize default chains
const createDefaultChains = (): Record<number, Chain> => {
  const chains: Record<number, Chain> = {};
  for (let i = 1; i <= 8; i++) {
    chains[i] = {
      id: i,
      symbol: i === 1 ? 'AAPL' : '',
      timeframe: '1m',
      color: CHAIN_COLORS[i],
    };
  }
  return chains;
};

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  chains: createDefaultChains(),
  activeChainId: 1,

  connection: {
    websocket: 'disconnected',
    lastEventTime: null,
    eventCount: 0,
  },

  events: [],
  maxEvents: 1000,

  decisionChains: {},

  trading: {
    mode: 'PAPER',
    liveArmed: false,
    killSwitchActive: false,
  },

  profile: {
    gate: 'standard',
    risk: 'standard',
    guard: 'standard',
  },

  orders: {},
  positions: {},
  executions: [],

  pendingCommands: {},

  // Chain actions
  setChainSymbol: (chainId, symbol) => {
    set((state) => ({
      chains: {
        ...state.chains,
        [chainId]: { ...state.chains[chainId], symbol: symbol.toUpperCase() },
      },
    }));
  },

  setChainTimeframe: (chainId, timeframe) => {
    set((state) => ({
      chains: {
        ...state.chains,
        [chainId]: { ...state.chains[chainId], timeframe },
      },
    }));
  },

  setActiveChain: (chainId) => {
    set({ activeChainId: chainId });
  },

  // Connection actions
  setConnectionStatus: (status) => {
    set((state) => ({
      connection: { ...state.connection, websocket: status },
    }));
  },

  addEvent: (event) => {
    set((state) => {
      const newEvents = [event, ...state.events].slice(0, state.maxEvents);
      return {
        events: newEvents,
        connection: {
          ...state.connection,
          lastEventTime: new Date(),
          eventCount: state.connection.eventCount + 1,
        },
      };
    });
  },

  clearEvents: () => {
    set({ events: [] });
  },

  // Decision chain actions
  updateDecisionChain: (symbol, chain) => {
    set((state) => ({
      decisionChains: {
        ...state.decisionChains,
        [symbol]: { ...state.decisionChains[symbol], ...chain, symbol },
      },
    }));
  },

  // Trading control actions
  setTradingMode: (mode) => {
    set((state) => ({
      trading: { ...state.trading, mode },
    }));
  },

  setLiveArmed: (armed) => {
    set((state) => ({
      trading: { ...state.trading, liveArmed: armed },
    }));
  },

  setKillSwitchActive: (active) => {
    set((state) => ({
      trading: { ...state.trading, killSwitchActive: active },
    }));
  },

  // Profile actions
  setProfile: (profile) => {
    set((state) => ({
      profile: { ...state.profile, ...profile },
    }));
  },

  // Event-derived state processors
  processOrderEvent: (event) => {
    const payload = event.payload as Record<string, unknown>;
    const clientOrderId = payload.client_order_id as string;
    const commandId = payload.command_id as string | undefined;

    if (!clientOrderId) return;

    set((state) => {
      const existingOrder = state.orders[clientOrderId];
      let newOrder: Order;

      switch (event.event_type) {
        case 'ORDER_SUBMITTED':
          newOrder = {
            client_order_id: clientOrderId,
            symbol: event.symbol || payload.symbol as string,
            side: payload.side as 'buy' | 'sell',
            quantity: payload.quantity as number,
            filled_quantity: 0,
            order_type: payload.order_type as string,
            limit_price: payload.limit_price as number | undefined,
            stop_price: payload.stop_price as number | undefined,
            status: 'submitted',
            timestamp: event.timestamp,
            command_id: commandId,
          };
          break;

        case 'ORDER_CONFIRMED':
          newOrder = {
            ...existingOrder,
            status: 'confirmed',
            timestamp: event.timestamp,
          };
          break;

        case 'ORDER_FILL_RECEIVED':
          const fillQty = payload.filled_quantity as number || payload.quantity as number;
          const totalFilled = (existingOrder?.filled_quantity || 0) + fillQty;
          const orderQty = existingOrder?.quantity || payload.order_quantity as number;
          newOrder = {
            ...existingOrder,
            filled_quantity: totalFilled,
            status: totalFilled >= orderQty ? 'filled' : 'partial',
            timestamp: event.timestamp,
          };
          break;

        case 'ORDER_CANCELLED':
          newOrder = {
            ...existingOrder,
            status: 'cancelled',
            timestamp: event.timestamp,
          };
          break;

        case 'ORDER_REJECTED':
          newOrder = {
            ...existingOrder,
            client_order_id: clientOrderId,
            symbol: event.symbol || existingOrder?.symbol || '',
            side: existingOrder?.side || payload.side as 'buy' | 'sell',
            quantity: existingOrder?.quantity || payload.quantity as number,
            filled_quantity: 0,
            order_type: existingOrder?.order_type || payload.order_type as string || 'market',
            status: 'rejected',
            timestamp: event.timestamp,
            command_id: commandId,
          };
          break;

        default:
          return state;
      }

      // Remove pending command if we have command_id
      const newPendingCommands = { ...state.pendingCommands };
      if (commandId && newPendingCommands[commandId]) {
        delete newPendingCommands[commandId];
      }

      return {
        orders: {
          ...state.orders,
          [clientOrderId]: newOrder,
        },
        pendingCommands: newPendingCommands,
      };
    });
  },

  processExecutionEvent: (event) => {
    if (event.event_type !== 'ORDER_FILL_RECEIVED') return;

    const payload = event.payload as Record<string, unknown>;
    const execId = payload.exec_id as string || event.event_id;

    set((state) => {
      // Check if execution already exists
      if (state.executions.some(e => e.exec_id === execId)) {
        return state;
      }

      const execution: Execution = {
        exec_id: execId,
        client_order_id: payload.client_order_id as string,
        symbol: event.symbol || payload.symbol as string,
        side: payload.side as 'buy' | 'sell',
        quantity: payload.filled_quantity as number || payload.quantity as number,
        price: payload.fill_price as number || payload.price as number,
        timestamp: event.timestamp,
      };

      return {
        executions: [execution, ...state.executions].slice(0, 1000),
      };
    });
  },

  processPositionEvent: (event) => {
    // Position updates come from POSITION_UPDATE events or can be derived from fills
    const payload = event.payload as Record<string, unknown>;
    const symbol = event.symbol || payload.symbol as string;

    if (!symbol) return;

    set((state) => {
      const position: Position = {
        symbol,
        quantity: payload.quantity as number,
        avg_price: payload.avg_price as number,
        current_price: payload.current_price as number || payload.avg_price as number,
        market_value: payload.market_value as number || 0,
        unrealized_pnl: payload.unrealized_pnl as number || 0,
        unrealized_pnl_pct: payload.unrealized_pnl_pct as number || 0,
        last_updated: event.timestamp,
      };

      return {
        positions: {
          ...state.positions,
          [symbol]: position,
        },
      };
    });
  },

  processSystemEvent: (event) => {
    const payload = event.payload as Record<string, unknown>;

    switch (event.event_type) {
      case 'SYSTEM_START':
        // Could extract trading mode from system start
        if (payload.trading_mode) {
          set((state) => ({
            trading: {
              ...state.trading,
              mode: payload.trading_mode as 'PAPER' | 'LIVE',
            },
          }));
        }
        break;

      case 'SYSTEM_STOP':
        // System stopped - could trigger kill switch visual
        break;

      default:
        // Handle profile updates, kill switch events, etc.
        if (payload.kill_switch_active !== undefined) {
          set((state) => ({
            trading: {
              ...state.trading,
              killSwitchActive: payload.kill_switch_active as boolean,
            },
          }));
        }
        if (payload.live_armed !== undefined) {
          set((state) => ({
            trading: {
              ...state.trading,
              liveArmed: payload.live_armed as boolean,
            },
          }));
        }
        if (payload.profile) {
          const profile = payload.profile as Record<string, string>;
          set((state) => ({
            profile: {
              gate: profile.gate as ProfileLevel || state.profile.gate,
              risk: profile.risk as ProfileLevel || state.profile.risk,
              guard: profile.guard as ProfileLevel || state.profile.guard,
            },
          }));
        }
        break;
    }
  },

  // Pending command actions
  addPendingCommand: (command) => {
    set((state) => ({
      pendingCommands: {
        ...state.pendingCommands,
        [command.command_id]: command,
      },
    }));
  },

  removePendingCommand: (commandId) => {
    set((state) => {
      const newPendingCommands = { ...state.pendingCommands };
      delete newPendingCommands[commandId];
      return { pendingCommands: newPendingCommands };
    });
  },

  // State reset for reconnect
  resetTradingState: () => {
    set({
      orders: {},
      positions: {},
      executions: [],
      decisionChains: {},
      pendingCommands: {},
    });
  },

  // Load initial state from GET /api/ui/state
  loadInitialState: (state) => {
    const orders = state.orders as Record<string, Order> | undefined;
    const positions = state.positions as Record<string, Position> | undefined;
    const executions = state.executions as Execution[] | undefined;
    const trading = state.trading as Partial<TradingState> | undefined;
    const profile = state.profile as Partial<ProfileState> | undefined;

    set((current) => ({
      orders: orders || current.orders,
      positions: positions || current.positions,
      executions: executions || current.executions,
      trading: trading ? { ...current.trading, ...trading } : current.trading,
      profile: profile ? { ...current.profile, ...profile } : current.profile,
    }));
  },
}));

// Selectors
export const useActiveChain = () => {
  const chains = useAppStore((s) => s.chains);
  const activeId = useAppStore((s) => s.activeChainId);
  return chains[activeId];
};

export const useChain = (chainId: number) => {
  return useAppStore((s) => s.chains[chainId]);
};

export const useConnectionStatus = () => {
  return useAppStore((s) => s.connection);
};

export const useEvents = () => {
  return useAppStore((s) => s.events);
};

export const useDecisionChain = (symbol: string) => {
  return useAppStore((s) => s.decisionChains[symbol]);
};

export const useTrading = () => {
  return useAppStore((s) => s.trading);
};

export const useProfile = () => {
  return useAppStore((s) => s.profile);
};

// Order selectors
export const useOrders = () => {
  return useAppStore((s) => s.orders);
};

export const useOpenOrders = () => {
  const orders = useAppStore((s) => s.orders);
  return Object.values(orders).filter(
    (o) => o.status === 'submitted' || o.status === 'confirmed' || o.status === 'partial' || o.status === 'pending'
  );
};

export const useOrdersBySymbol = (symbol: string) => {
  const orders = useAppStore((s) => s.orders);
  return Object.values(orders).filter((o) => o.symbol === symbol);
};

// Position selectors
export const usePositions = () => {
  return useAppStore((s) => s.positions);
};

export const usePosition = (symbol: string) => {
  return useAppStore((s) => s.positions[symbol]);
};

export const useTotalPnL = () => {
  const positions = useAppStore((s) => s.positions);
  return Object.values(positions).reduce((sum, p) => sum + p.unrealized_pnl, 0);
};

// Execution selectors
export const useExecutions = () => {
  return useAppStore((s) => s.executions);
};

export const useExecutionsBySymbol = (symbol: string) => {
  const executions = useAppStore((s) => s.executions);
  return executions.filter((e) => e.symbol === symbol);
};

// Pending command selectors
export const usePendingCommands = () => {
  return useAppStore((s) => s.pendingCommands);
};

export const useHasPendingCommand = (commandType?: string) => {
  const pending = useAppStore((s) => s.pendingCommands);
  if (!commandType) return Object.keys(pending).length > 0;
  return Object.values(pending).some((c) => c.command_type === commandType);
};
