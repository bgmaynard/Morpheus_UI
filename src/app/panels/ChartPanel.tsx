/**
 * Chart Panel - Price chart with signal overlays
 *
 * Uses LightweightCharts for candlestick display.
 * Chain-aware: symbol syncs with active chain.
 *
 * Fetches REAL candle data from Morpheus API (Schwab).
 * No demo/synthetic data.
 *
 * Overlays from Morpheus events:
 * - Signal markers (SIGNAL_CANDIDATE)
 * - Regime labels (REGIME_DETECTED)
 * - Score confidence (SIGNAL_SCORED)
 * - Entry/invalidation levels
 *
 * Read-only: Charts do not trigger trades.
 */

import { ComponentContainer } from 'golden-layout';
import { useEffect, useRef, useCallback, useState, KeyboardEvent } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  ColorType,
  CrosshairMode,
  LineStyle,
  SeriesMarker,
  IPriceLine,
} from 'lightweight-charts';
import { useActiveChain, useAppStore, useDecisionChain } from '../store/useAppStore';
import { getAPIClient, CandleData } from '../morpheus/apiClient';
import './panels.css';

interface Props {
  container: ComponentContainer;
}

// Convert API candle data to LightweightCharts format
function convertCandles(candles: CandleData[]): CandlestickData[] {
  return candles.map((c) => ({
    time: c.time as Time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

export function ChartPanel({ container }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  const activeChain = useActiveChain();
  const activeChainId = useAppStore((s) => s.activeChainId);
  const setChainSymbol = useAppStore((s) => s.setChainSymbol);
  const decisionChain = useDecisionChain(activeChain.symbol);

  // Symbol input state
  const [symbolInput, setSymbolInput] = useState(activeChain.symbol || '');

  // Market data state
  const [isLoading, setIsLoading] = useState(false);
  const [marketDataAvailable, setMarketDataAvailable] = useState<boolean | null>(null);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync input when chain changes externally
  useEffect(() => {
    setSymbolInput(activeChain.symbol || '');
  }, [activeChain.symbol]);

  // Handle Enter key to update chain symbol
  const handleSymbolKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const newSymbol = symbolInput.trim().toUpperCase();
      if (newSymbol && newSymbol !== activeChain.symbol) {
        setChainSymbol(activeChainId, newSymbol);
      }
    }
  }, [symbolInput, activeChain.symbol, activeChainId, setChainSymbol]);

  // Check market data availability on mount
  useEffect(() => {
    const checkMarketData = async () => {
      try {
        const client = getAPIClient();
        const status = await client.getMarketStatus();
        setMarketDataAvailable(status.available);
      } catch {
        setMarketDataAvailable(false);
      }
    };
    checkMarketData();
  }, []);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#1e1e1e' },
        textColor: '#b0b0b0',
      },
      grid: {
        vertLines: { color: '#2d2d2d' },
        horzLines: { color: '#2d2d2d' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#5a5a5a',
          labelBackgroundColor: '#333333',
        },
        horzLine: {
          color: '#5a5a5a',
          labelBackgroundColor: '#333333',
        },
      },
      rightPriceScale: {
        borderColor: '#3c3c3c',
      },
      timeScale: {
        borderColor: '#3c3c3c',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00d26a',
      downColor: '#ff4757',
      borderUpColor: '#00d26a',
      borderDownColor: '#ff4757',
      wickUpColor: '#00d26a',
      wickDownColor: '#ff4757',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    // GoldenLayout container resize
    container.on('resize', handleResize);

    // Initial size
    handleResize();

    // ResizeObserver for container changes
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, [container]);

  // Fetch candles when symbol changes
  useEffect(() => {
    if (!candleSeriesRef.current || !activeChain.symbol) {
      setLastPrice(null);
      return;
    }

    const fetchCandles = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const client = getAPIClient();
        const response = await client.getCandles(activeChain.symbol, 'day', 1, 1);

        if (response.candles && response.candles.length > 0) {
          const chartCandles = convertCandles(response.candles);
          candleSeriesRef.current?.setData(chartCandles);

          // Set last price from most recent candle
          const lastCandle = response.candles[response.candles.length - 1];
          setLastPrice(lastCandle.close);

          // Fit content
          if (chartRef.current) {
            chartRef.current.timeScale().fitContent();
          }
        } else {
          // No candles returned - clear chart
          candleSeriesRef.current?.setData([]);
          setLastPrice(null);
          setError('No candle data available');
        }
      } catch (err) {
        console.error('Failed to fetch candles:', err);
        // Clear the chart on error
        candleSeriesRef.current?.setData([]);
        setLastPrice(null);

        if (err instanceof Error && err.message.includes('503')) {
          setError('Market data not configured');
        } else {
          setError('Failed to load chart data');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchCandles();
  }, [activeChain.symbol]);

  // Add signal markers from decision chain
  useEffect(() => {
    if (!candleSeriesRef.current || !decisionChain) return;

    const markers: SeriesMarker<Time>[] = [];

    // Signal marker
    if (decisionChain.signal) {
      const time = Math.floor(new Date(decisionChain.signal.timestamp).getTime() / 1000) as Time;
      markers.push({
        time,
        position: decisionChain.signal.direction === 'long' ? 'belowBar' : 'aboveBar',
        color: decisionChain.signal.direction === 'long' ? '#00d26a' : '#ff4757',
        shape: decisionChain.signal.direction === 'long' ? 'arrowUp' : 'arrowDown',
        text: `${decisionChain.signal.strategy_name}`,
      });
    }

    // Gate decision marker
    if (decisionChain.gate) {
      const time = Math.floor(new Date(decisionChain.gate.timestamp).getTime() / 1000) as Time;
      markers.push({
        time,
        position: 'aboveBar',
        color: decisionChain.gate.decision === 'approved' ? '#00d26a' : '#ff4757',
        shape: 'circle',
        text: decisionChain.gate.decision === 'approved' ? 'GATE OK' : 'REJECTED',
      });
    }

    // Order fill marker
    if (decisionChain.order && decisionChain.order.status === 'ORDER_FILL_RECEIVED') {
      const time = Math.floor(new Date(decisionChain.order.timestamp).getTime() / 1000) as Time;
      markers.push({
        time,
        position: 'inBar',
        color: '#3498db',
        shape: 'square',
        text: `FILL ${decisionChain.order.filled_quantity}`,
      });
    }

    candleSeriesRef.current.setMarkers(markers);
  }, [decisionChain]);

  // Add price lines for entry/invalidation levels
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    // Remove existing price lines
    priceLinesRef.current.forEach((line) => {
      candleSeriesRef.current?.removePriceLine(line);
    });
    priceLinesRef.current = [];

    // Add entry price line
    if (decisionChain?.signal?.entry_price) {
      const entryLine = candleSeriesRef.current.createPriceLine({
        price: decisionChain.signal.entry_price,
        color: '#3498db',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'Entry',
      });
      priceLinesRef.current.push(entryLine);
    }

    // Add stop price line (invalidation)
    if (decisionChain?.signal?.stop_price) {
      const stopLine = candleSeriesRef.current.createPriceLine({
        price: decisionChain.signal.stop_price,
        color: '#e74c3c',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Stop',
      });
      priceLinesRef.current.push(stopLine);
    }

    // Add target price line
    if (decisionChain?.signal?.target_price) {
      const targetLine = candleSeriesRef.current.createPriceLine({
        price: decisionChain.signal.target_price,
        color: '#2ecc71',
        lineWidth: 2,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: 'Target',
      });
      priceLinesRef.current.push(targetLine);
    }
  }, [decisionChain?.signal?.entry_price, decisionChain?.signal?.stop_price, decisionChain?.signal?.target_price]);

  // Format regime for display
  const formatRegime = (regime: string): string => {
    return regime.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="morpheus-panel chart-panel">
      <div className="morpheus-panel-header">
        <span className="panel-title">
          <span className="chain-indicator" style={{ backgroundColor: activeChain.color }} />
          <input
            type="text"
            className="symbol-input"
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
            onKeyDown={handleSymbolKeyDown}
            placeholder="SYMBOL"
            spellCheck={false}
          />
          <span className="timeframe-label">- {activeChain.timeframe}</span>
          {lastPrice !== null && (
            <span className="last-price">${lastPrice.toFixed(2)}</span>
          )}
        </span>
        <div className="chart-info">
          {isLoading && <span className="loading-badge">Loading...</span>}
          {decisionChain?.regime && (
            <span className="regime-badge">
              {formatRegime(decisionChain.regime.regime)}
            </span>
          )}
          {decisionChain?.signal && (
            <span className={`signal-badge ${decisionChain.signal.direction}`}>
              {decisionChain.signal.direction.toUpperCase()}
            </span>
          )}
          {decisionChain?.score && (
            <span className="score-badge">
              {(decisionChain.score.confidence * 100).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
      <div className="chart-container" ref={chartContainerRef}>
        {!activeChain.symbol && (
          <div className="chart-placeholder-overlay">
            <div className="placeholder-message">
              <div className="placeholder-icon">📈</div>
              <div className="placeholder-text">
                Select a symbol to view chart
              </div>
            </div>
          </div>
        )}
        {activeChain.symbol && marketDataAvailable === false && (
          <div className="chart-placeholder-overlay">
            <div className="placeholder-message">
              <div className="placeholder-icon">⚠️</div>
              <div className="placeholder-text">
                Market data not configured.<br />
                Set up Schwab credentials to enable.
              </div>
            </div>
          </div>
        )}
        {activeChain.symbol && error && !isLoading && marketDataAvailable !== false && (
          <div className="chart-placeholder-overlay">
            <div className="placeholder-message">
              <div className="placeholder-icon">⏳</div>
              <div className="placeholder-text">
                {error}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
