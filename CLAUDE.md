# Morpheus Trading System - Claude Context

## System Overview
Morpheus is a momentum trading system for small-cap stocks, consisting of two main components:
- **Morpheus_AI** (C:\Morpheus_AI) - Python backend: signal generation, risk management, order execution
- **Morpheus_UI** (C:\Morpheus_UI) - Electron frontend: trading desktop with docking panels

The human reads tape in Thinkorswim, sees signals in Morpheus UI, confirms entries, and Morpheus executes.

---

## Morpheus_AI (Backend)

### Tech Stack
- Python 3.11+
- FastAPI for REST API and WebSocket
- Schwab API for market data and order execution

### Directory Structure
```
morpheus/
├── ai/          # ML models, scoring
├── broker/      # Schwab integration
├── core/        # Core types, config
├── data/        # Market data handlers
├── execution/   # Order execution
├── features/    # Feature engineering
├── regime/      # Market regime detection
├── risk/        # Risk management, position sizing
├── scoring/     # Signal scoring
├── server/      # FastAPI server, WebSocket
├── services/    # Background services
└── strategies/  # Trading strategies
```

### Key Endpoints
- `GET /api/market/status` - Market data availability
- `GET /api/market/candles/{symbol}` - OHLCV candle data
- `GET /api/market/quotes` - Real-time quotes
- `POST /api/trading/confirm-entry` - Human confirms signal
- `POST /api/trading/cancel-order` - Cancel order
- `WS /ws/events` - Real-time event stream

### Event Types
- `REGIME_DETECTED` - Market regime change
- `SIGNAL_CANDIDATE` - New trading signal
- `SIGNAL_SCORED` - AI confidence score
- `META_APPROVED/REJECTED` - Gate decision
- `RISK_APPROVED/VETO` - Risk check result
- `ORDER_SUBMITTED/CONFIRMED/FILL_RECEIVED` - Order lifecycle
- `POSITION_UPDATE` - Position changes

### Running
```bash
cd C:\Morpheus_AI
python -m morpheus.server.main
# or
start_morpheus.bat
```
Runs on http://localhost:8010

---

## Morpheus_UI (Frontend)

### Tech Stack
- Electron + React + TypeScript
- Vite for bundling
- GoldenLayout v2 for docking panels
- LightweightCharts v4 for charting
- Zustand for state management

### Directory Structure
```
src/app/
├── panels/      # Panel components
├── components/  # Shared components (ChainBar, StatusBar)
├── hooks/       # Custom hooks
├── utils/       # Utilities (chartIndicators)
├── store/       # Zustand store
└── morpheus/    # API client, WebSocket client
electron/        # Main process, preload
```

### Panel Types
- **ChartPanel** - Candlesticks with EMA 9/20, VWAP, Volume, MACD
- **DecisionSupportPanel** - Signal confirmation UI
- **OrdersPanel** - Open orders with filters
- **PositionsPanel** - Current positions
- **ExecutionsPanel** - Trade history
- **WatchlistPanel** - Symbol watchlist
- **EventStreamPanel** - Raw event log
- **MorpheusDecisionPanel** - Decision chain visualization
- **TradingControlsPanel** - Mode switching, kill switch

### Chain System
Sterling Trader Pro style linking - 8 colored chains that sync symbol across panels:
- Each chain has: symbol, timeframe, color
- Charts now have independent timeframes for multi-timeframe analysis

### Running
```bash
cd C:\Morpheus_UI
npm run dev
```

---

## Recent UI Changes (This Session)

### Chart Panel Enhancements
- **Indicators**: EMA 9 (grey), EMA 20 (blue), VWAP (yellow-orange solid), Volume, MACD
- **MACD colors**: Histogram green/red (above/below zero), MACD line blue, Signal yellow
- **Resizable panels**: Draggable dividers between price/volume/MACD
- **Independent timeframes**: Each chart has own timeframe selector

### Orders Panel
- Status mapping: Working, Open, Partial, Filled, Canceled, Rejected
- Filter tabs: Active | Filled | Closed | All
- Color-coded badges

### Decision Support Panel
- Compact 3-row layout (state + countdown, symbol + direction + reasons, confirm button)

### Layout Management
- Save/Load/Delete layouts via ChainBar menu
- Persistence in localStorage

---

## Known Issues
- **Intraday data unavailable**: Schwab API returns empty for minute timeframes. Only 1D works.
- Some pre-existing TypeScript errors in codebase

---

## Development Notes

### API Data Format
Candles: `{ time: unix_timestamp, open, high, low, close, volume }`

### Indicator Calculations (chartIndicators.ts)
- `calculateEMA(closes, period)` - Exponential moving average
- `calculateVWAP(candles)` - Volume-weighted average price (resets daily)
- `calculateMACD(closes, fast, slow, signal)` - MACD with histogram

### WebSocket Events
Events come through with structure:
```typescript
{
  event_type: string,
  timestamp: string,
  symbol?: string,
  payload: Record<string, unknown>
}
```

---

## Next Steps / Ideas
- Fix intraday data (different API params or data source)
- Add more indicators (Bollinger Bands, RSI)
- Indicator toggle UI
- Alert system for signals
