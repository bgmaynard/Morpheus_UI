/**
 * Chart Panel - Price chart with indicators
 *
 * Uses LightweightCharts for candlestick display.
 * Chain-aware: symbol and timeframe sync with active chain.
 *
 * Features:
 * - Time axis formatting based on timeframe
 * - EMA 9/20 overlays
 * - VWAP overlay
 * - Volume sub-panel
 * - MACD sub-panel
 * - Signal markers from Morpheus events
 */

import { ComponentContainer } from 'golden-layout';
import { useEffect, useRef, useCallback, useState, KeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
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
import { useActiveChain, useAppStore, useDecisionChain, Timeframe, CHAIN_COLORS } from '../store/useAppStore';

const TIMEFRAMES: Timeframe[] = ['10s', '1m', '5m', '1D'];
import { getAPIClient, CandleData } from '../morpheus/apiClient';
import {
  calculateEMAWithTime,
  calculateVWAP,
  calculateMACDWithTime,
  getVolumeData,
} from '../utils/chartIndicators';
import './panels.css';

interface Props {
  container: ComponentContainer;
}

// Time formatter based on timeframe
function getTimeFormatter(timeframe: Timeframe): (time: number) => string {
  switch (timeframe) {
    case '10s':
    case '1m':
      return (time: number) => {
        const date = new Date(time * 1000);
        const hours = date.getHours().toString().padStart(2, '0');
        const mins = date.getMinutes().toString().padStart(2, '0');
        const secs = date.getSeconds().toString().padStart(2, '0');
        return `${hours}:${mins}:${secs}`;
      };
    case '5m':
      return (time: number) => {
        const date = new Date(time * 1000);
        const hours = date.getHours().toString().padStart(2, '0');
        const mins = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${mins}`;
      };
    case '1D':
    default:
      return (time: number) => {
        const date = new Date(time * 1000);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getDate()}`;
      };
  }
}

// API parameters based on timeframe
function getAPIParams(timeframe: Timeframe): { periodType: string; period: number; frequency: number } {
  switch (timeframe) {
    case '10s':
      return { periodType: 'minute', period: 1, frequency: 1 };
    case '1m':
      return { periodType: 'minute', period: 1, frequency: 1 };
    case '5m':
      return { periodType: 'minute', period: 5, frequency: 1 };
    case '1D':
    default:
      return { periodType: 'day', period: 1, frequency: 1 };
  }
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
  const ema9SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const macdLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const signalLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistogramRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const candleDataRef = useRef<CandleData[]>([]);

  const activeChain = useActiveChain();
  const activeChainId = useAppStore((s) => s.activeChainId);
  const setChainSymbol = useAppStore((s) => s.setChainSymbol);
  const decisionChain = useDecisionChain(activeChain.symbol);

  // Symbol input state
  const [symbolInput, setSymbolInput] = useState(activeChain.symbol || '');

  // Independent timeframe for this chart (defaults to chain's timeframe)
  const [localTimeframe, setLocalTimeframe] = useState<Timeframe>(activeChain.timeframe);

  // Market data state
  const [isLoading, setIsLoading] = useState(false);
  const [marketDataAvailable, setMarketDataAvailable] = useState<boolean | null>(null);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Panel resize state - independent heights (percentages)
  const [priceHeight, setPriceHeight] = useState(0.60); // Price chart: 60%
  const [volumeHeight, setVolumeHeight] = useState(0.20); // Volume: 20%
  // MACD gets the rest: 1 - priceHeight - volumeHeight = 20%
  const [isDragging, setIsDragging] = useState<'price-volume' | 'volume-macd' | null>(null);
  const dragStartY = useRef<number>(0);
  const dragStartValue = useRef<number>(0);

  // Sync input when chain changes externally
  useEffect(() => {
    setSymbolInput(activeChain.symbol || '');
  }, [activeChain.symbol]);

  // Handle panel resize drag
  const handleDragStart = useCallback((divider: 'price-volume' | 'volume-macd', e: ReactMouseEvent) => {
    e.preventDefault();
    setIsDragging(divider);
    dragStartY.current = e.clientY;
    dragStartValue.current = divider === 'price-volume' ? priceHeight : volumeHeight;
  }, [priceHeight, volumeHeight]);

  const handleDragMove = useCallback((e: globalThis.MouseEvent) => {
    if (!isDragging || !chartContainerRef.current) return;

    const containerHeight = chartContainerRef.current.clientHeight;
    const deltaY = e.clientY - dragStartY.current;
    const deltaPct = deltaY / containerHeight;

    if (isDragging === 'price-volume') {
      // Dragging the divider between price and volume
      // This changes price height, volume stays same size, MACD adjusts
      const newPriceHeight = dragStartValue.current + deltaPct;
      const macdHeight = 1 - newPriceHeight - volumeHeight;
      // Constrain: price min 30%, MACD min 10%
      if (newPriceHeight >= 0.30 && macdHeight >= 0.10) {
        setPriceHeight(newPriceHeight);
      }
    } else {
      // Dragging the divider between volume and MACD
      // This changes volume height, price stays same, MACD adjusts
      const newVolumeHeight = dragStartValue.current + deltaPct;
      const macdHeight = 1 - priceHeight - newVolumeHeight;
      // Constrain: volume min 5%, MACD min 10%
      if (newVolumeHeight >= 0.05 && macdHeight >= 0.10) {
        setVolumeHeight(newVolumeHeight);
      }
    }
  }, [isDragging, priceHeight, volumeHeight]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(null);
  }, []);

  // Attach global mouse listeners for drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Update chart scale margins when panel sizes change
  useEffect(() => {
    if (!chartRef.current) return;

    const macdHeight = 1 - priceHeight - volumeHeight;
    const volumeTop = priceHeight;
    const macdTop = priceHeight + volumeHeight;

    // Update main price scale (top portion)
    chartRef.current.priceScale('right').applyOptions({
      scaleMargins: { top: 0.02, bottom: 1 - priceHeight + 0.01 },
    });

    // Update volume scale (middle portion)
    chartRef.current.priceScale('volume').applyOptions({
      scaleMargins: { top: volumeTop + 0.01, bottom: macdHeight + 0.01 },
    });

    // Update MACD scale (bottom portion)
    chartRef.current.priceScale('macd').applyOptions({
      scaleMargins: { top: macdTop + 0.01, bottom: 0.02 },
    });
  }, [priceHeight, volumeHeight]);

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
        scaleMargins: {
          top: 0.02,
          bottom: 0.41, // Initial 60% price height - updated by resize state
        },
      },
      timeScale: {
        borderColor: '#3c3c3c',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Main candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00d26a',
      downColor: '#ff4757',
      borderUpColor: '#00d26a',
      borderDownColor: '#ff4757',
      wickUpColor: '#00d26a',
      wickDownColor: '#ff4757',
    });

    // EMA 9 - Grey line
    const ema9Series = chart.addLineSeries({
      color: '#888888',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // EMA 20 - Blue line
    const ema20Series = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // VWAP - Yellow-orange solid line
    const vwapSeries = chart.addLineSeries({
      color: '#FFA500',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // Volume series - Middle section (initial: 60%-80%)
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.61, bottom: 0.21 }, // Initial - updated by resize state
    });

    // MACD series - Bottom section (initial: 80%-100%)
    const macdHistogram = chart.addHistogramSeries({
      color: '#ef5350',
      priceScaleId: 'macd',
      priceFormat: { type: 'price', precision: 4 },
    });
    const macdLine = chart.addLineSeries({
      color: '#2196F3',
      lineWidth: 2,
      priceScaleId: 'macd',
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const signalLine = chart.addLineSeries({
      color: '#FFEB3B',
      lineWidth: 2,
      priceScaleId: 'macd',
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chart.priceScale('macd').applyOptions({
      scaleMargins: { top: 0.81, bottom: 0.02 }, // Initial - updated by resize state
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    ema9SeriesRef.current = ema9Series;
    ema20SeriesRef.current = ema20Series;
    vwapSeriesRef.current = vwapSeries;
    volumeSeriesRef.current = volumeSeries;
    macdLineRef.current = macdLine;
    signalLineRef.current = signalLine;
    macdHistogramRef.current = macdHistogram;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    container.on('resize', handleResize);
    handleResize();

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      ema9SeriesRef.current = null;
      ema20SeriesRef.current = null;
      vwapSeriesRef.current = null;
      volumeSeriesRef.current = null;
      macdLineRef.current = null;
      signalLineRef.current = null;
      macdHistogramRef.current = null;
    };
  }, [container]);

  // Update time formatter when timeframe changes
  useEffect(() => {
    if (!chartRef.current) return;

    const timeFormatter = getTimeFormatter(localTimeframe);
    chartRef.current.applyOptions({
      localization: {
        timeFormatter,
      },
      timeScale: {
        secondsVisible: localTimeframe === '10s',
      },
    });
  }, [localTimeframe]);

  // Update indicators when candle data changes
  const updateIndicators = useCallback((candles: CandleData[]) => {
    if (!candles.length) return;

    // EMA 9
    if (ema9SeriesRef.current) {
      const ema9Data = calculateEMAWithTime(candles, 9);
      ema9SeriesRef.current.setData(
        ema9Data.map((d) => ({ time: d.time as Time, value: d.value }))
      );
    }

    // EMA 20
    if (ema20SeriesRef.current) {
      const ema20Data = calculateEMAWithTime(candles, 20);
      ema20SeriesRef.current.setData(
        ema20Data.map((d) => ({ time: d.time as Time, value: d.value }))
      );
    }

    // VWAP
    if (vwapSeriesRef.current) {
      const vwapData = calculateVWAP(candles);
      vwapSeriesRef.current.setData(
        vwapData.map((d) => ({ time: d.time as Time, value: d.value }))
      );
    }

    // Volume
    if (volumeSeriesRef.current) {
      const volumeData = getVolumeData(candles);
      volumeSeriesRef.current.setData(
        volumeData.map((d) => ({ time: d.time as Time, value: d.value, color: d.color }))
      );
    }

    // MACD
    if (macdLineRef.current && signalLineRef.current && macdHistogramRef.current) {
      const macdData = calculateMACDWithTime(candles, 12, 26, 9);
      macdLineRef.current.setData(
        macdData.map((d) => ({ time: d.time as Time, value: d.macd }))
      );
      signalLineRef.current.setData(
        macdData.map((d) => ({ time: d.time as Time, value: d.signal }))
      );
      macdHistogramRef.current.setData(
        macdData.map((d) => ({
          time: d.time as Time,
          value: d.histogram,
          color: d.histogram >= 0 ? '#26a69a' : '#ef5350', // Green above zero, red below
        }))
      );
    }
  }, []);

  // Fetch candles when symbol or timeframe changes
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
        const { periodType, period, frequency } = getAPIParams(localTimeframe);
        const response = await client.getCandles(activeChain.symbol, periodType, period, frequency);

        if (response.candles && response.candles.length > 0) {
          candleDataRef.current = response.candles;
          const chartCandles = convertCandles(response.candles);
          candleSeriesRef.current?.setData(chartCandles);

          // Update indicators
          updateIndicators(response.candles);

          // Set last price
          const lastCandle = response.candles[response.candles.length - 1];
          setLastPrice(lastCandle.close);

          // Fit content
          if (chartRef.current) {
            chartRef.current.timeScale().fitContent();
          }

          // Clear any error
          setError(null);
        } else {
          candleSeriesRef.current?.setData([]);
          ema9SeriesRef.current?.setData([]);
          ema20SeriesRef.current?.setData([]);
          vwapSeriesRef.current?.setData([]);
          volumeSeriesRef.current?.setData([]);
          macdLineRef.current?.setData([]);
          signalLineRef.current?.setData([]);
          macdHistogramRef.current?.setData([]);
          setLastPrice(null);
          setError('No candle data available');
        }
      } catch (err) {
        console.error('Failed to fetch candles:', err);
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
  }, [activeChain.symbol, localTimeframe, updateIndicators]);

  // Add signal markers from decision chain
  useEffect(() => {
    if (!candleSeriesRef.current || !decisionChain) return;

    const markers: SeriesMarker<Time>[] = [];

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

    priceLinesRef.current.forEach((line) => {
      candleSeriesRef.current?.removePriceLine(line);
    });
    priceLinesRef.current = [];

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
          {lastPrice !== null && (
            <span className="last-price">${lastPrice.toFixed(2)}</span>
          )}
        </span>
        <div className="chart-timeframe-selector">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              className={`chart-tf-btn ${localTimeframe === tf ? 'active' : ''}`}
              onClick={() => setLocalTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
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
        {/* Drag handles for resizing panels */}
        <div
          className="chart-drag-handle"
          style={{ top: `${priceHeight * 100}%` }}
          onMouseDown={(e) => handleDragStart('price-volume', e)}
          title="Drag to resize price/volume panels"
        />
        <div
          className="chart-drag-handle"
          style={{ top: `${(priceHeight + volumeHeight) * 100}%` }}
          onMouseDown={(e) => handleDragStart('volume-macd', e)}
          title="Drag to resize volume/MACD panels"
        />
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
