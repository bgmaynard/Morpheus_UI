# Morpheus UI - Claude Context

## Project Overview
Electron-based trading desktop UI for the Morpheus trading system. Uses GoldenLayout for docking panels, LightweightCharts for charting, and Zustand for state management.

## Tech Stack
- **Framework**: Electron + React + TypeScript
- **Build**: Vite
- **Layout**: GoldenLayout v2
- **Charts**: LightweightCharts v4
- **State**: Zustand
- **Backend**: Connects to Morpheus_AI via WebSocket (ws://localhost:8010/ws/events) and REST API (http://localhost:8010)

## Architecture

### Key Directories
- `src/app/panels/` - Panel components (Chart, Orders, Positions, etc.)
- `src/app/components/` - Shared components (ChainBar, StatusBar)
- `src/app/hooks/` - Custom hooks (useHotkeys, useLayoutManager)
- `src/app/utils/` - Utilities (chartIndicators.ts)
- `src/app/store/` - Zustand store (useAppStore.ts)
- `src/app/morpheus/` - API client and WebSocket client
- `electron/` - Electron main process and preload

### Chain System
Sterling Trader Pro style "chains" - 8 colored chains that link panels together. Each chain has:
- Symbol (e.g., AAPL)
- Timeframe (10s, 1m, 5m, 1D) - Note: Only 1D has data from Schwab API currently
- Color identifier

## Recent Changes (Latest Session)

### Chart Panel Enhancements
- **Indicators**: EMA 9 (grey), EMA 20 (blue), VWAP (yellow-orange), Volume, MACD
- **MACD**: Histogram (green above zero, red below), MACD line (blue), Signal line (yellow)
- **Resizable panels**: Drag dividers between price/volume/MACD sections
- **Independent timeframes**: Each chart has its own timeframe selector (not tied to ChainBar)
- **Time axis formatting**: Adapts based on timeframe selection

### Orders Panel
- Status mapping: internal states → user-friendly labels (Working, Open, Partial, Filled, Canceled, Rejected)
- Filter tabs: Active | Filled | Closed | All
- Color-coded status badges

### Decision Support Panel
- Compact 3-row layout:
  - Row 1: READY/BLOCKED badge + TTL countdown
  - Row 2: Symbol | Direction | Block reasons (inline chips)
  - Row 3: Confirm button

### Executions Panel
- Info banner: "Morpheus orders only - manual TOS trades not shown"

### Layout Management
- `useLayoutManager` hook wrapping IPC bridge
- Layout menu in ChainBar: Save, Save As, load saved layouts, delete, reset
- Layout persistence enabled in localStorage

## Known Issues / Limitations
- **Intraday data not available**: Schwab API returns empty candles for minute-based timeframes (10s, 1m, 5m). Only 1D works.
- Pre-existing TypeScript errors in codebase (not introduced by recent changes)

## File Reference

### Key Files Modified
- `src/app/panels/ChartPanel.tsx` - Main chart with indicators
- `src/app/panels/OrdersPanel.tsx` - Orders with filtering
- `src/app/panels/DecisionSupportPanel.tsx` - Compact layout
- `src/app/panels/ExecutionsPanel.tsx` - Info banner
- `src/app/panels/panels.css` - Panel styling
- `src/app/components/ChainBar.tsx` - Layout menu added
- `src/app/components/ChainBar.css` - Layout menu styling
- `src/app/App.tsx` - Layout persistence enabled
- `src/app/hooks/useLayoutManager.ts` - New hook
- `src/app/utils/chartIndicators.ts` - EMA, VWAP, MACD calculations

## Running the App
```bash
npm run dev
```
This starts both Vite dev server and Electron.

## API Endpoints Used
- `GET /api/market/status` - Check if market data is available
- `GET /api/market/candles/{symbol}?period_type=day&period=1&frequency=1` - Fetch candle data
- `GET /api/market/quotes?symbols=...` - Fetch quotes
- `POST /api/trading/confirm-entry` - Confirm entry signal
- WebSocket `/ws/events` - Real-time event stream

## Next Steps / Ideas
- Fix intraday data (may need different Schwab API params or data source)
- Add more indicators (Bollinger Bands, RSI, etc.)
- Indicator toggle UI (show/hide individual indicators)
- Save indicator preferences per chart
