# Morpheus_UI Phase 1: Sterling Shell - Review Document

**Date:** 2026-01-17
**Status:** Implementation Complete - Awaiting Review

---

## Summary

Morpheus_UI Phase 1 is complete. A Sterling Trader Pro style desktop application has been built using Electron + React + GoldenLayout. The UI renders state and sends commands - it never makes trading decisions.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Morpheus_UI (Electron + React + GoldenLayout)                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Chain Bar: [●1][●2][●3][●4][●5][●6][●7][●8] AAPL 1m    │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ ┌──────────┐ ┌─────────────────┐ ┌──────────────────┐  │   │
│  │ │Watchlist │ │     Chart       │ │ Morpheus Decision│  │   │
│  │ │ 8 symbols│ │   (Phase 2)     │ │ Signal→Score→    │  │   │
│  │ ├──────────┤ │                 │ │ Gate→Risk→Order  │  │   │
│  │ │  Order   │ ├─────────────────┤ ├──────────────────┤  │   │
│  │ │  Entry   │ │Orders│Positions│ │   Event Stream   │  │   │
│  │ │ BUY/SELL │ ├─────────────────┤ ├──────────────────┤  │   │
│  │ │          │ │   Executions    │ │                  │  │   │
│  │ └──────────┘ └─────────────────┘ └──────────────────┘  │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ Status: ● Disconnected │ Events: 0 │ PAPER            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
          │                                    ▲
          │ REST Commands                      │ WebSocket Events
          ▼                                    │
┌─────────────────────────────────────────────────────────────────┐
│  Morpheus_AI (http://localhost:8010)                            │
│  - POST /api/ui/command     - WS /ws/events                     │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Desktop Shell | Electron | 28.x |
| UI Framework | React | 18.x |
| Docking System | GoldenLayout | 2.x |
| State Management | Zustand | 4.x |
| Build Tool | Vite | 5.x |
| Language | TypeScript | 5.x |

## File Structure

```
C:\Morpheus_UI\
├── package.json
├── tsconfig.json
├── tsconfig.electron.json      # Electron-specific TS config
├── tsconfig.node.json
├── vite.config.ts
├── index.html                  # Vite entry point
├── .gitignore
├── .eslintrc.cjs
│
├── electron/
│   ├── main.ts                 # Electron main process
│   └── preload.ts              # IPC bridge (context isolation)
│
├── dist/electron/              # Compiled Electron files
│   ├── main.js
│   └── preload.js
│
└── src/
    ├── main.tsx                # React entry point
    ├── vite-env.d.ts
    │
    ├── styles/
    │   └── global.css          # Sterling dark theme + GoldenLayout overrides
    │
    └── app/
        ├── App.tsx             # Main app with GoldenLayout workspace
        │
        ├── store/
        │   └── useAppStore.ts  # Zustand: chains, connection, events, trading
        │
        ├── morpheus/
        │   ├── eventTypes.ts   # MorpheusEvent, DecisionChain, EVENT_CATEGORIES
        │   ├── wsClient.ts     # WebSocket client with auto-reconnect
        │   └── apiClient.ts    # REST client for commands
        │
        ├── components/
        │   ├── ChainBar.tsx    # Symbol chain selector (8 colored dots)
        │   ├── ChainBar.css
        │   ├── StatusBar.tsx   # Connection status, event count, trading mode
        │   └── StatusBar.css
        │
        └── panels/
            ├── ChartPanel.tsx          # Placeholder for charting
            ├── WatchlistPanel.tsx      # Symbol list + chain assignment
            ├── OrderEntryPanel.tsx     # Manual order form
            ├── OrdersPanel.tsx         # Open orders + cancel
            ├── PositionsPanel.tsx      # Positions + P&L
            ├── ExecutionsPanel.tsx     # Execution log
            ├── EventStreamPanel.tsx    # Live Morpheus event feed
            ├── MorpheusDecisionPanel.tsx # Decision chain visualization
            ├── panels.css
            └── index.ts
```

## Features Implemented

### 1. GoldenLayout Docking Workspace
- All 8 panels are dockable, draggable, resizable
- Tabs can be rearranged, stacked, split
- Layout automatically saves to localStorage on changes
- Loads saved layout on startup (or default if none)

### 2. Symbol Chain Linking (Sterling-style)
- 8 color-coded chains (Blue, Red, Green, Yellow, Purple, Teal, Orange, Gray)
- Clicking a chain dot selects it as active
- Active chain symbol syncs across all chain-aware panels
- Symbols can be assigned from Watchlist via chain dots
- Timeframe selector (10s, 1m, 5m, 1D)

### 3. WebSocket Event Client
- Connects to `ws://localhost:8010/ws/events`
- Auto-reconnect with exponential backoff (1s, 2s, 4s, 8s... max 30s)
- Max 10 reconnect attempts
- Parses newline-delimited JSON events
- Updates Zustand store on each event

### 4. REST API Client
- Base URL: `http://localhost:8010`
- Timeout: 10 seconds
- Commands:
  - `SUBMIT_MANUAL_ORDER` - Submit order through Morpheus risk checks
  - `CANCEL_ORDER` - Cancel by client_order_id
  - `CANCEL_ALL` - Cancel all open orders
  - `SET_PROFILE` - Change gate/risk/guard profile
  - `ARM_LIVE_TRADING` - Enable live trading (requires confirmation)
  - `DISARM_LIVE_TRADING` - Disable live trading

### 5. Zustand State Store
```typescript
interface AppState {
  chains: Record<number, Chain>;        // 8 symbol chains
  activeChainId: number;                // Currently selected chain
  connection: ConnectionStatus;         // WS state, event count
  events: MorpheusEvent[];              // Last 1000 events
  decisionChains: Record<string, DecisionChain>;  // Per-symbol decisions
  trading: TradingState;                // PAPER/LIVE, armed, kill switch
}
```

### 6. Panel Shells

| Panel | Purpose | Status |
|-------|---------|--------|
| ChartPanel | Price chart display | Placeholder (Phase 2) |
| WatchlistPanel | Symbol list with chain assignment | Demo data |
| OrderEntryPanel | BUY/SELL order form | Functional (sends to API) |
| OrdersPanel | Open orders with cancel | Demo data |
| PositionsPanel | Positions with P&L | Demo data |
| ExecutionsPanel | Trade execution log | Demo data |
| EventStreamPanel | Live Morpheus events | Functional (shows events) |
| MorpheusDecisionPanel | Decision chain visualization | Functional (updates from events) |

### 7. Event Processing
The UI processes these Morpheus events to update the decision chain:
- `SIGNAL_CANDIDATE` → Updates signal stage
- `SIGNAL_SCORED` → Updates score stage
- `META_APPROVED/META_REJECTED` → Updates gate stage
- `RISK_APPROVED/RISK_VETO` → Updates risk stage
- `ORDER_SUBMITTED/ORDER_CONFIRMED/ORDER_FILL_RECEIVED` → Updates order stage

## Communication Protocol

### Events (Morpheus → UI via WebSocket)
```typescript
interface MorpheusEvent {
  event_id: string;
  event_type: EventType;
  timestamp: string;
  payload: Record<string, unknown>;
  trade_id?: string;
  symbol?: string;
  correlation_id?: string;
}
```

### Commands (UI → Morpheus via REST)
```typescript
interface Command {
  type: CommandType;
  payload: Record<string, unknown>;
}

// Example: Submit manual order
{
  type: 'SUBMIT_MANUAL_ORDER',
  payload: {
    symbol: 'AAPL',
    side: 'buy',
    quantity: 100,
    order_type: 'limit',
    limit_price: 175.00
  }
}
```

## Running the Application

```bash
cd C:\Morpheus_UI
npm install
npm run dev
```

This runs:
1. `build:electron` - Compiles TypeScript to dist/electron/
2. `dev:vite` - Starts Vite dev server on localhost:5173
3. `dev:electron` - Launches Electron loading from Vite

## Screenshots

The UI displays:
- Dark theme matching Sterling Trader Pro aesthetic
- 8 dockable panels in default layout
- Chain bar with colored dots and symbol input
- Status bar showing connection state and trading mode
- All panels render correctly with demo data

## Design Principles Followed

1. **UI Renders State, Never Decides** - All trading decisions come from Morpheus_AI
2. **Event-Driven Updates** - UI reacts to events, doesn't poll
3. **Command Pattern** - UI sends commands, Morpheus executes
4. **Idempotent Commands** - Commands include intent IDs for safety
5. **Paper/Live Separation** - Trading mode clearly visible, LIVE requires arming

## Known Limitations (Phase 1)

1. Chart panel is placeholder (needs charting library in Phase 2)
2. Panels show demo data (will be event-driven in production)
3. No keyboard shortcuts yet (Mousetrap ready but not wired)
4. No layout export/import to file (only localStorage)

## Phase 2 Preview

- Integrate lightweight-charts or similar for ChartPanel
- Wire panels to real event data (remove demo data)
- Add keyboard shortcuts (Mousetrap)
- Add sound alerts for fills/errors
- Layout save/load to named files

---

## Questions for Reviewer

1. Should the UI maintain any local order/position state, or rely entirely on Morpheus events?
2. Is the command schema correct for integration with Morpheus_AI REST endpoints?
3. Any additional panels needed for Phase 1 scope?

---

**Ready for architectural review.**
