# UI Phase 1: Sterling Shell

## Objective
Create the foundational Morpheus_UI desktop application using Electron + React + GoldenLayout, establishing the dockable panel architecture and communication layer with Morpheus_AI.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Morpheus_UI (Electron + React)                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Chain Bar  [●1][●2][●3][●4][●5][●6][●7][●8]  AAPL 1m │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  ┌──────────┐ ┌─────────────────────┐ ┌────────────┐  │  │
│  │  │Watchlist │ │       Chart         │ │ Morpheus   │  │  │
│  │  │          │ │                     │ │ Decision   │  │  │
│  │  ├──────────┤ │                     │ ├────────────┤  │  │
│  │  │  Order   │ ├─────────────────────┤ │   Event    │  │  │
│  │  │  Entry   │ │ Orders │ Positions  │ │   Stream   │  │  │
│  │  │          │ ├─────────────────────┤ ├────────────┤  │  │
│  │  │          │ │     Executions      │ │            │  │  │
│  │  └──────────┘ └─────────────────────┘ └────────────┘  │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  Status: ● Connected │ Events: 1,234 │ PAPER       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │                                    ▲
          │  REST API (commands)               │ WebSocket (events)
          ▼                                    │
┌─────────────────────────────────────────────────────────────┐
│  Morpheus_AI (Event-Driven Trading Engine)                  │
└─────────────────────────────────────────────────────────────┘
```

## Deliverables

### Core Infrastructure
- [x] Electron + React + TypeScript project setup
- [x] Vite build configuration
- [x] GoldenLayout docking workspace
- [x] Layout persistence (save/load to localStorage)

### Communication Layer
- [x] WebSocket client (`wsClient.ts`) - connects to `ws://localhost:8010/ws/events`
- [x] REST API client (`apiClient.ts`) - sends commands to `http://localhost:8010/api/ui/command`
- [x] Event type definitions (`eventTypes.ts`)
- [x] Zustand state store (`useAppStore.ts`)

### UI Components
- [x] **ChainBar** - 8 colored chain dots, symbol input, timeframe selector
- [x] **StatusBar** - Connection status, event count, trading mode indicator

### Panel Shells (render state, send commands)
- [x] **ChartPanel** - Placeholder for chart integration (Phase 2)
- [x] **WatchlistPanel** - Symbol list with chain assignment
- [x] **OrderEntryPanel** - Manual order submission form
- [x] **OrdersPanel** - Active orders display with cancel
- [x] **PositionsPanel** - Open positions with P&L
- [x] **ExecutionsPanel** - Trade execution log
- [x] **EventStreamPanel** - Live Morpheus event feed with filters
- [x] **MorpheusDecisionPanel** - Decision chain visualization (Signal → Score → Gate → Risk → Order)

### Symbol Chain Linking (Sterling-style)
- [x] 8 color-coded chains
- [x] Chain selection syncs across panels
- [x] Symbol assignment from watchlist

## Technical Stack

| Component | Technology |
|-----------|------------|
| Desktop Shell | Electron 28.x |
| UI Framework | React 18.x |
| Docking | GoldenLayout 2.x |
| State | Zustand 4.x |
| Build | Vite 5.x |
| Language | TypeScript 5.x |

## Communication Protocol

### WebSocket Events (Morpheus → UI)
```typescript
interface MorpheusEvent {
  event_id: string;
  event_type: EventType;
  timestamp: string;
  payload: Record<string, unknown>;
  trade_id?: string;
  symbol?: string;
}
```

### REST Commands (UI → Morpheus)
```typescript
interface Command {
  type: CommandType;
  payload: Record<string, unknown>;
}

type CommandType =
  | 'SET_SYMBOL_CHAIN'
  | 'SUBMIT_MANUAL_ORDER'
  | 'CANCEL_ORDER'
  | 'CANCEL_ALL'
  | 'SET_PROFILE'
  | 'ARM_LIVE_TRADING'
  | 'DISARM_LIVE_TRADING';
```

## Files Created

```
Morpheus_UI/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── .gitignore
├── .eslintrc.cjs
├── electron/
│   ├── main.ts          # Electron main process
│   └── preload.ts       # IPC bridge
├── public/
│   └── index.html
└── src/
    ├── main.tsx         # React entry point
    ├── vite-env.d.ts
    ├── styles/
    │   └── global.css   # Sterling dark theme
    └── app/
        ├── App.tsx      # Main app with GoldenLayout
        ├── store/
        │   └── useAppStore.ts
        ├── morpheus/
        │   ├── eventTypes.ts
        │   ├── wsClient.ts
        │   └── apiClient.ts
        ├── components/
        │   ├── ChainBar.tsx
        │   ├── ChainBar.css
        │   ├── StatusBar.tsx
        │   └── StatusBar.css
        └── panels/
            ├── ChartPanel.tsx
            ├── WatchlistPanel.tsx
            ├── OrderEntryPanel.tsx
            ├── OrdersPanel.tsx
            ├── PositionsPanel.tsx
            ├── ExecutionsPanel.tsx
            ├── EventStreamPanel.tsx
            ├── MorpheusDecisionPanel.tsx
            └── panels.css
```

## Getting Started

```bash
cd C:\Morpheus_UI
npm install
npm run dev
```

## Phase 2 Preview
- Chart integration (TradingView lightweight-charts or similar)
- Real market data display
- Live position/order updates from events
- Keyboard shortcuts (Mousetrap)

---

**Design Principle**: The UI renders state and sends commands. Morpheus_AI makes all trading decisions.
