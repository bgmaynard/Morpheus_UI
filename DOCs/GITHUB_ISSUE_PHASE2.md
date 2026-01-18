# UI Phase 2: Trading Cycle Wiring

## Objective
Wire the UI to Morpheus_AI for real trading operations. All state is event-derived. UI sends commands, waits for events, never assumes success.

## Scope

### 1. Command Envelope Update
Every UI → Morpheus command must include:
```typescript
interface Command {
  command_id: string;      // UUID, UI-generated
  command_type: CommandType;
  payload: Record<string, unknown>;
  timestamp: string;       // ISO-8601
}
```

### 2. Order Entry Wiring
- `SUBMIT_MANUAL_ORDER` - sends command, shows pending state, updates on events
- `CANCEL_ORDER` - cancel by client_order_id
- `CANCEL_ALL` - cancel all open orders
- No optimistic updates - wait for `ORDER_SUBMITTED` / `ORDER_REJECTED`

### 3. Live Panels (Event-Derived State)
| Panel | Events |
|-------|--------|
| OrdersPanel | `ORDER_SUBMITTED`, `ORDER_CONFIRMED`, `ORDER_REJECTED`, `ORDER_CANCELLED`, `ORDER_FILL_RECEIVED` |
| PositionsPanel | Derived from fills + initial state |
| ExecutionsPanel | `ORDER_FILL_RECEIVED` |

### 4. Trading Mode Controls
- **Mode Toggle**: PAPER / LIVE (visual indicator)
- **Live Armed**: Requires typed confirmation code
- **Kill Switch**: Emergency stop, visual red indicator

### 5. Profile Selectors
Dropdowns for:
- Meta Gate profile: `standard` | `permissive` | `strict`
- Risk profile: `standard` | `permissive` | `strict`
- Execution Guard profile: `standard` | `permissive` | `strict`

Changes send `SET_PROFILE` command.

## NOT in Phase 2
- Charts integration
- Indicators
- Hotkeys
- PnL calculations
- Analytics

## Design Principle
```
User clicks Buy
→ UI sends command (with command_id)
→ UI shows "pending" visual state
→ Morpheus emits ORDER_SUBMITTED / ORDER_REJECTED
→ UI updates state from event
```

**UI is never authoritative. Morpheus events are truth.**
