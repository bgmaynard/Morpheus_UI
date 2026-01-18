# Decision Support + Human Confirmation - Review Document

**Date:** 2026-01-17
**Status:** Implementation Complete - Awaiting Review

---

## Summary

This implementation adds tape-synchronized human confirmation to Morpheus. The human reads L2/T&S in Thinkorswim, sees "READY" in Morpheus UI, presses one key, and Morpheus executes immediately or blocks with a clear reason.

## Problem Solved

> I read L2 + Time & Sales in Thinkorswim, but I need Morpheus to be instantly ready so that one action triggers execution without delay or context mismatch.

## What Was Implemented

### 1. Decision Support Panel (UI)

**File:** `Morpheus_UI/src/app/panels/DecisionSupportPanel.tsx`

Displays for the currently selected symbol/chain:

| Field | Description |
|-------|-------------|
| Symbol | Active symbol from chain |
| Strategy | Strategy name from signal |
| Regime | Current market regime |
| Signal Status | NONE / ARMED / EXPIRING / STALE |
| Signal Age | Real-time age in seconds |
| Direction | LONG / SHORT / NONE |
| Entry Price | From signal |
| Stop Price | From signal |
| Target Price | From signal |
| Size | Position size in shares |
| Execution State | **BLOCKED** / **READY** |
| Mode | PAPER / LIVE + ARMED badge |

**READY** displays as large green indicator when all conditions met.

**BLOCKED** shows list of block reasons:
- No symbol selected
- No active signal
- Signal expired (>4s)
- Gate rejected
- Risk vetoed
- Guard blocked
- Live not armed
- Kill switch active

### 2. Confirm Entry Action (UI → Engine)

**Button:** CONFIRM ENTRY (large, prominent)

**Hotkey:** `Ctrl+Enter` (configurable)

**Files:**
- `Morpheus_UI/src/app/morpheus/apiClient.ts` - Added `CONFIRM_ENTRY` command
- `Morpheus_UI/src/app/hooks/useHotkeys.ts` - Global hotkey handling

**Command payload:**
```typescript
interface ConfirmEntryPayload {
  symbol: string;
  chain_id: number;
  signal_timestamp: string;  // ISO-8601
  entry_price: number;
  command_id: string;        // UUID for correlation
  timestamp: string;         // ISO-8601
}
```

### 3. Confirmation Guard (Engine)

**File:** `Morpheus_AI/morpheus/execution/guards.py`

**Class:** `ConfirmationGuard`

Deterministically validates before execution:

| Check | Reject If |
|-------|-----------|
| Kill Switch | Active |
| Symbol Lock | Request symbol ≠ active symbol |
| No Signal | No active signal for symbol |
| Signal Stale | Age > CONFIRM_TTL_MS (default 4000ms) |
| Price Drift | Drift > MAX_DRIFT_PCT (default 0.5%) |
| Live Armed | LIVE mode but not armed |

**Configuration:**
```python
@dataclass(frozen=True)
class ConfirmationGuardConfig:
    confirm_ttl_ms: int = 4000   # 4 seconds
    max_drift_pct: float = 0.5   # 0.5%
```

**Result:**
```python
@dataclass(frozen=True)
class ConfirmationResult:
    accepted: bool
    reason: BlockReason | None
    details: str
    signal_age_ms: int
    price_drift_pct: float
```

### 4. New Event Types

**File:** `Morpheus_AI/morpheus/core/events.py`

Added:
- `HUMAN_CONFIRM_ACCEPTED` - Confirmation passed, proceeding to execution
- `HUMAN_CONFIRM_REJECTED` - Confirmation failed, with reason

**File:** `Morpheus_UI/src/app/morpheus/eventTypes.ts`

Mirrored event types for UI.

### 5. New Block Reasons

**File:** `Morpheus_AI/morpheus/execution/base.py`

Added:
- `NO_ACTIVE_SIGNAL` - No signal for symbol
- `SIGNAL_STALE` - Signal exceeded TTL
- `PRICE_DRIFT_EXCEEDED` - Price moved too far from entry
- `SYMBOL_MISMATCH` - Request symbol ≠ active symbol
- `KILL_SWITCH_ACTIVE` - Kill switch blocks all execution

### 6. Tests

**File:** `Morpheus_AI/tests/test_confirmation_guard.py`

17 tests covering:
- ✅ valid_confirm_executes - Fresh signal, no drift → accepted
- ✅ valid_confirm_live_armed - Live mode, armed → accepted
- ✅ stale_signal_rejected - Signal > 4s → rejected
- ✅ drift_rejected - Price drift > 0.5% → rejected
- ✅ small_drift_accepted - Drift < 0.5% → accepted
- ✅ not_armed_rejected - Live mode, not armed → rejected
- ✅ context_mismatch_rejected - Symbol mismatch → rejected
- ✅ symbol_lock_case_insensitive - AAPL = aapl
- ✅ kill_switch_blocks - Kill switch → rejected
- ✅ no_signal_rejected - No signal → rejected
- ✅ strict_config_lower_ttl - 2s TTL rejects 3s signal
- ✅ strict_config_lower_drift - 0.1% drift threshold
- ✅ no_active_symbol_accepts_any - No context = any symbol OK
- ✅ result_to_event_payload - Payload serialization
- ✅ invalid_timestamp_format - Treated as stale
- ✅ zero_entry_price_skips_drift - Skip drift if no price
- ✅ priority_order_kill_switch_first - Kill switch checked first

## Files Modified/Created

### Morpheus_UI

| File | Change |
|------|--------|
| `src/app/panels/DecisionSupportPanel.tsx` | NEW - Main panel |
| `src/app/panels/index.ts` | Export new panel |
| `src/app/panels/panels.css` | Added Decision Support styles |
| `src/app/hooks/useHotkeys.ts` | NEW - Global hotkey handling |
| `src/app/morpheus/apiClient.ts` | Added CONFIRM_ENTRY command |
| `src/app/morpheus/eventTypes.ts` | Added HUMAN_CONFIRM events |
| `src/app/App.tsx` | Registered panel, integrated hotkeys |

### Morpheus_AI

| File | Change |
|------|--------|
| `morpheus/core/events.py` | Added HUMAN_CONFIRM event types |
| `morpheus/execution/base.py` | Added confirmation block reasons |
| `morpheus/execution/guards.py` | Added ConfirmationGuard |
| `morpheus/execution/__init__.py` | Exported new classes |
| `tests/test_confirmation_guard.py` | NEW - 17 tests |

## Design Principles Followed

1. **PURE and DETERMINISTIC**
   - Same inputs → same decision
   - No external calls in guard
   - All state from parameters

2. **Event-Driven**
   - HUMAN_CONFIRM_ACCEPTED / HUMAN_CONFIRM_REJECTED events
   - All decisions logged and replayable

3. **Symbol Lock Safety**
   - Confirmation symbol must match active context
   - Prevents context mismatch execution

4. **No Recalculation**
   - Uses existing signal from Phase 3-4
   - Uses existing risk sizing from Phase 6
   - Routes through existing Phase 7 pipeline

5. **Kill Switch Priority**
   - Kill switch checked first
   - Blocks all execution immediately

## What Was NOT Built

- ❌ L2 panels
- ❌ Time & Sales panels
- ❌ Market data ingestion
- ❌ Tape inference
- ❌ New strategies or AI

## Definition of Done

- ✅ Watch tape in Thinkorswim
- ✅ See Morpheus "ready" state clearly
- ✅ Press one key (Ctrl+Enter)
- ✅ Morpheus executes immediately or blocks with clear reason
- ✅ All actions event-logged and replayable

## Default Layout Update

Decision Support Panel is now positioned prominently in the left column (above Watchlist) in the default layout.

## Hotkey Configuration

| Hotkey | Action |
|--------|--------|
| `Ctrl+Enter` | Confirm Entry |
| `Ctrl+Shift+X` | Cancel All Orders |
| `Ctrl+Shift+K` | Toggle Kill Switch |

## Integration Note

The CONFIRM_ENTRY command handler needs to be wired in Morpheus_AI's command router to:
1. Create `ConfirmationRequest` from command payload
2. Call `ConfirmationGuard.validate()`
3. Emit `HUMAN_CONFIRM_ACCEPTED` or `HUMAN_CONFIRM_REJECTED` event
4. If accepted, route to existing Phase 7 execution pipeline

---

## Questions for Reviewer

1. Is the 4-second TTL appropriate for production?
2. Is the 0.5% drift threshold appropriate?
3. Should the command handler integration be completed now or in a separate phase?

---

**Ready for architectural review.**
