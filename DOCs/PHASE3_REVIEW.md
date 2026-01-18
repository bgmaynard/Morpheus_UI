# Morpheus_UI Phase 3: Charts & Signal Visualization - Review Document

**Date:** 2026-01-17
**Status:** Implementation Complete - Awaiting Review

---

## Summary

Morpheus_UI Phase 3 integrates LightweightCharts for candlestick visualization with event-driven overlays. Charts are chain-aware and display signal markers, regime labels, score confidence, and price level lines from Morpheus events.

## Key Changes

### 1. LightweightCharts Integration

**File:** `package.json`

Added dependency:
```json
"lightweight-charts": "^4.1.0"
```

### 2. ChartPanel Component

**File:** `src/app/panels/ChartPanel.tsx`

Features:
- LightweightCharts candlestick series
- Dark theme matching Morpheus UI
- Auto-resize on container changes (GoldenLayout + ResizeObserver)
- Chain-aware symbol switching
- Demo data generator (until Morpheus provides real OHLC data)

### 3. Signal Markers Overlay

Signal markers appear on the chart when decision chain updates:

- **SIGNAL_CANDIDATE**: Arrow markers (up for long, down for short)
- **META_APPROVED/META_REJECTED**: Circle markers (green/red)
- **ORDER_FILL_RECEIVED**: Square markers (blue)

Marker colors:
- Long signals: `#00d26a` (green)
- Short signals: `#ff4757` (red)
- Fills: `#3498db` (blue)

### 4. Regime Labels

**File:** `src/app/morpheus/eventTypes.ts`

Added regime to DecisionChain:
```typescript
regime?: {
  regime: string; // e.g., 'trending', 'mean_reverting', 'volatile', 'quiet'
  confidence: number;
  timestamp: string;
};
```

Regime is displayed as a badge in the chart header, formatted for readability (e.g., "mean_reverting" -> "Mean Reverting").

### 5. Score Confidence Overlay

Displayed in chart header as a percentage badge when score is available from SIGNAL_SCORED events.

### 6. Entry/Invalidation Price Lines

**File:** `src/app/panels/ChartPanel.tsx`

Price lines are drawn when signal includes price levels:

- **Entry Line**: Solid blue line (`#3498db`)
- **Stop Line**: Dashed red line (`#e74c3c`)
- **Target Line**: Dotted green line (`#2ecc71`)

Signal price levels added to DecisionChain:
```typescript
signal?: {
  direction: 'long' | 'short' | 'none';
  strategy_name: string;
  entry_price?: number;
  stop_price?: number;
  target_price?: number;
  timestamp: string;
};
```

### 7. Event Routing Updates

**File:** `src/app/App.tsx`

Added REGIME_DETECTED event handling:
```typescript
case 'REGIME_DETECTED':
  updateDecisionChain(symbol, {
    regime: {
      regime: event.payload.regime as string,
      confidence: event.payload.confidence as number || 1.0,
      timestamp: event.timestamp,
    },
  });
  break;
```

Updated SIGNAL_CANDIDATE to include price levels.

### 8. Chart Header Display

The chart header shows:
- Chain indicator (color dot)
- Symbol and timeframe
- Regime badge (when available)
- Signal direction badge (LONG/SHORT/NONE)
- Score confidence percentage

## Files Modified

| File | Changes |
|------|---------|
| `package.json` | Added lightweight-charts dependency |
| `src/app/morpheus/eventTypes.ts` | Added regime to DecisionChain, signal price levels |
| `src/app/panels/ChartPanel.tsx` | Complete rewrite with LightweightCharts |
| `src/app/panels/panels.css` | Added chart and overlay styles |
| `src/app/App.tsx` | Added REGIME_DETECTED routing, signal price levels |

## CSS Classes Added

```css
.chart-panel - Chart panel container
.chart-container - Chart render area
.chart-placeholder-overlay - No symbol placeholder
.chart-info - Header info container
.signal-badge - Signal direction badge (long/short/none)
.score-badge - Confidence percentage badge
.regime-badge - Regime label badge
```

## Design Principles Followed

1. **Event-Derived Overlays**
   - All markers and lines come from Morpheus events
   - Chart never generates signals
   - UI only renders what Morpheus sends

2. **Chain-Aware**
   - Symbol changes with active chain
   - Chart data regenerates on symbol switch
   - Overlays update based on symbol's decision chain

3. **Read-Only**
   - Charts do not trigger trades
   - Visual feedback only
   - No click-to-trade functionality

4. **Demo Data for Development**
   - Demo candle generator until Morpheus provides OHLC
   - Consistent data based on symbol seed
   - Realistic price ranges per symbol

## NOT in Phase 3

- Real OHLC data from Morpheus (waiting for MARKET_SNAPSHOT integration)
- Multiple timeframe support
- Chart annotations/drawing tools
- Indicator overlays (RSI, MACD, etc.)
- Volume display
- Click-to-trade

## Expected Events from Morpheus

For full functionality, Morpheus should send:

1. **REGIME_DETECTED** with payload:
   - `regime`: string (e.g., "trending", "mean_reverting")
   - `confidence`: number (0-1)

2. **SIGNAL_CANDIDATE** with payload:
   - `direction`: "long" | "short" | "none"
   - `strategy_name`: string
   - `entry_price`: number (optional)
   - `stop_price`: number (optional)
   - `target_price`: number (optional)

3. **MARKET_SNAPSHOT** (future) with payload:
   - OHLC data for real candlesticks

## Testing Notes

To test:
1. Run `npm install` (if not done since Phase 2)
2. Run `npm run dev`
3. Select a symbol in Watchlist
4. Observe chart renders with demo data
5. When connected to Morpheus, observe:
   - Regime badge updates on REGIME_DETECTED
   - Signal markers appear on SIGNAL_CANDIDATE
   - Price lines appear when signal includes entry/stop/target
   - Score badge updates on SIGNAL_SCORED

---

## Questions for Reviewer

1. Should regime have additional visual representation (e.g., background color change on chart)?
2. Should price lines persist across symbol changes or clear when switching?
3. Is the demo data generator appropriate for development, or should it be removed?

---

**Ready for architectural review.**
