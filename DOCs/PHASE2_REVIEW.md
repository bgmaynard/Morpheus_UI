# Morpheus_UI Phase 2: Trading Cycle Wiring - Review Document

**Date:** 2026-01-17
**Status:** Implementation Complete - Awaiting Review

---

## Summary

Morpheus_UI Phase 2 wires the UI to Morpheus_AI for real trading operations. All state is event-derived. UI sends commands and waits for events - it never assumes success optimistically.

## Key Changes

### 1. Command Envelope with command_id

Every UI → Morpheus command now includes:
```typescript
interface Command {
  command_id: string;      // UUID, UI-generated
  command_type: CommandType;
  payload: Record<string, unknown>;
  timestamp: string;       // ISO-8601
}
```

**File:** `src/app/morpheus/apiClient.ts`

Features:
- UUID generation for each command
- Pending command tracking
- Automatic cleanup of stale commands (> 60 seconds)
- Command correlation for UI feedback

### 2. Event-Derived State in Zustand Store

**File:** `src/app/store/useAppStore.ts`

New state:
```typescript
orders: Record<string, Order>;      // keyed by client_order_id
positions: Record<string, Position>; // keyed by symbol
executions: Execution[];
pendingCommands: Record<string, PendingCommand>;
profile: ProfileState;
```

New actions:
- `processOrderEvent()` - handles ORDER_SUBMITTED, ORDER_CONFIRMED, ORDER_FILL_RECEIVED, ORDER_CANCELLED, ORDER_REJECTED
- `processExecutionEvent()` - creates executions from ORDER_FILL_RECEIVED
- `processPositionEvent()` - handles POSITION_UPDATE
- `processSystemEvent()` - handles SYSTEM_START, SYSTEM_STOP, trading mode changes
- `addPendingCommand()` / `removePendingCommand()` - command tracking
- `loadInitialState()` - for GET /api/ui/state on reconnect

New selectors:
- `useOpenOrders()` - orders with status submitted/confirmed/partial
- `usePositions()` / `usePosition(symbol)`
- `useTotalPnL()` - sum of unrealized P&L
- `useExecutions()` / `useExecutionsBySymbol(symbol)`
- `useHasPendingCommand(type?)` - check for pending commands

### 3. Order Entry Panel

**File:** `src/app/panels/OrderEntryPanel.tsx`

Pattern implemented:
```
User clicks Buy
→ UI sends command (with command_id)
→ UI tracks pending command
→ UI shows "pending" visual state
→ Morpheus emits ORDER_SUBMITTED / ORDER_REJECTED
→ Store updates from event
→ Pending command removed
```

Features:
- Prevents double-submit while pending
- Shows "Pending..." state during wait
- Message updates based on command status

### 4. Orders Panel (Event-Derived)

**File:** `src/app/panels/OrdersPanel.tsx`

- Uses `useOpenOrders()` selector
- No demo data - shows live orders from events
- Cancel sends CANCEL_ORDER command
- Cancel All sends CANCEL_ALL command

### 5. Positions Panel (Event-Derived)

**File:** `src/app/panels/PositionsPanel.tsx`

- Uses `usePositions()` and `useTotalPnL()` selectors
- No demo data - shows live positions from events
- Total P&L calculated from position data

### 6. Executions Panel (Event-Derived)

**File:** `src/app/panels/ExecutionsPanel.tsx`

- Uses `useExecutions()` selector
- No demo data - populated from ORDER_FILL_RECEIVED events

### 7. Trading Controls Panel (NEW)

**File:** `src/app/panels/TradingControlsPanel.tsx`

Critical safety controls:

**Trading Mode:**
- Shows PAPER or LIVE mode
- Visual distinction between modes

**Live Armed:**
- Requires typing "ARM LIVE" to confirm
- Shows red ARMED badge when active
- Disarm button when armed

**Kill Switch:**
- Large red "ACTIVATE KILL SWITCH" button
- Blinks when active
- Deactivate option

**Profile Selectors:**
- Gate profile: standard | permissive | strict
- Risk profile: standard | permissive | strict
- Guard profile: standard | permissive | strict
- Changes send SET_PROFILE command

### 8. Event Routing in App.tsx

**File:** `src/app/App.tsx`

Events are routed to appropriate processors:
- `ORDER_*` → `processOrderEvent()` + `processExecutionEvent()`
- `POSITION_UPDATE` → `processPositionEvent()`
- `SYSTEM_*` → `processSystemEvent()`

### 9. Theme Update

Changed from blue-tinted dark theme to neutral gray for better readability:
- Background: `#1e1e1e` (VSCode-style)
- Panel: `#1e1e1e`
- Header: `#333333`
- Border: `#3c3c3c`

## Files Modified

| File | Changes |
|------|---------|
| `src/app/morpheus/apiClient.ts` | Added command_id, pending tracking |
| `src/app/store/useAppStore.ts` | Added event-derived state, processors |
| `src/app/App.tsx` | Added event routing to processors |
| `src/app/panels/OrderEntryPanel.tsx` | Command pattern with pending state |
| `src/app/panels/OrdersPanel.tsx` | Event-derived, no demo data |
| `src/app/panels/PositionsPanel.tsx` | Event-derived, no demo data |
| `src/app/panels/ExecutionsPanel.tsx` | Event-derived, no demo data |
| `src/app/panels/TradingControlsPanel.tsx` | NEW - trading mode, kill switch, profiles |
| `src/app/panels/panels.css` | Added trading controls styles |
| `src/styles/global.css` | Neutral gray theme |
| `electron/main.ts` | Updated background color |

## Design Principles Followed

1. **Event-Derived State Only**
   - UI never assumes success
   - All state changes come from Morpheus events
   - No optimistic updates

2. **Command Correlation**
   - Every command has UUID
   - UI can track pending commands
   - Events can reference command_id

3. **Safety Controls**
   - Live trading requires typed confirmation
   - Kill switch prominently displayed
   - Mode clearly visible at all times

4. **No Local Business Logic**
   - UI doesn't calculate positions from fills
   - UI doesn't reconcile orders
   - Morpheus is source of truth

## NOT in Phase 2

- Charts integration
- Indicators
- Hotkeys
- PnL calculations (beyond displaying what Morpheus sends)
- Analytics

## Testing Notes

To test:
1. Run Morpheus_AI with WebSocket endpoint at `ws://localhost:8010/ws/events`
2. Run Morpheus_UI: `npm run dev`
3. Submit orders via Order Entry
4. Observe Orders/Positions/Executions panels update from events
5. Test Trading Controls (profile changes, kill switch)

---

## Questions for Reviewer

1. Is the command_id correlation pattern correct? Should events echo command_id for direct correlation?
2. Should positions be derived from fills in the UI, or always come from Morpheus POSITION_UPDATE events?
3. Is the Kill Switch UX appropriate for production?

---

**Ready for architectural review.**
