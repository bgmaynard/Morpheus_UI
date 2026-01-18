/**
 * Chart Indicators - Technical analysis calculations
 *
 * Provides EMA, VWAP, and MACD calculations for chart overlays.
 */

import { CandleData } from '../morpheus/apiClient';

export interface EMAResult {
  time: number;
  value: number;
}

export interface VWAPResult {
  time: number;
  value: number;
}

export interface MACDResult {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

/**
 * Calculate Exponential Moving Average
 */
export function calculateEMA(closes: number[], period: number): number[] {
  if (closes.length < period) {
    return [];
  }

  const multiplier = 2 / (period + 1);
  const ema: number[] = [];

  // Start with SMA for first EMA value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += closes[i];
  }
  ema.push(sum / period);

  // Calculate EMA for remaining values
  for (let i = period; i < closes.length; i++) {
    const value = (closes[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(value);
  }

  return ema;
}

/**
 * Calculate EMA with time values for chart series
 */
export function calculateEMAWithTime(
  candles: CandleData[],
  period: number
): EMAResult[] {
  const closes = candles.map((c) => c.close);
  const ema = calculateEMA(closes, period);

  // EMA values start at index (period - 1) of the candles
  const results: EMAResult[] = [];
  for (let i = 0; i < ema.length; i++) {
    results.push({
      time: candles[i + period - 1].time,
      value: ema[i],
    });
  }

  return results;
}

/**
 * Calculate Volume Weighted Average Price (VWAP)
 * Resets at the start of each day for intraday charts
 */
export function calculateVWAP(candles: CandleData[]): VWAPResult[] {
  if (candles.length === 0) {
    return [];
  }

  const results: VWAPResult[] = [];
  let cumulativeTPV = 0; // Typical Price * Volume
  let cumulativeVolume = 0;
  let currentDay = '';

  for (const candle of candles) {
    // Get day from timestamp to detect day change
    const day = new Date(candle.time * 1000).toDateString();

    // Reset VWAP at the start of each day
    if (day !== currentDay) {
      cumulativeTPV = 0;
      cumulativeVolume = 0;
      currentDay = day;
    }

    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    const volume = candle.volume || 1; // Default to 1 if no volume

    cumulativeTPV += typicalPrice * volume;
    cumulativeVolume += volume;

    const vwap = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice;

    results.push({
      time: candle.time,
      value: vwap,
    });
  }

  return results;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * Default: 12-period fast EMA, 26-period slow EMA, 9-period signal line
 */
export function calculateMACD(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
  if (closes.length < slowPeriod) {
    return { macd: [], signal: [], histogram: [] };
  }

  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  // MACD line = Fast EMA - Slow EMA
  // Align the arrays (slow EMA starts later)
  const offset = slowPeriod - fastPeriod;
  const macd: number[] = [];

  for (let i = 0; i < slowEMA.length; i++) {
    macd.push(fastEMA[i + offset] - slowEMA[i]);
  }

  // Signal line = 9-period EMA of MACD
  const signal = calculateEMA(macd, signalPeriod);

  // Histogram = MACD - Signal
  const histogram: number[] = [];
  const signalOffset = signalPeriod - 1;

  for (let i = 0; i < signal.length; i++) {
    histogram.push(macd[i + signalOffset] - signal[i]);
  }

  return { macd, signal, histogram };
}

/**
 * Calculate MACD with time values for chart series
 */
export function calculateMACDWithTime(
  candles: CandleData[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult[] {
  const closes = candles.map((c) => c.close);
  const { macd, signal, histogram } = calculateMACD(closes, fastPeriod, slowPeriod, signalPeriod);

  // Results start at index (slowPeriod + signalPeriod - 2)
  const startIndex = slowPeriod + signalPeriod - 2;
  const results: MACDResult[] = [];

  for (let i = 0; i < histogram.length; i++) {
    results.push({
      time: candles[i + startIndex].time,
      macd: macd[i + signalPeriod - 1],
      signal: signal[i],
      histogram: histogram[i],
    });
  }

  return results;
}

/**
 * Get volume data formatted for histogram series
 */
export function getVolumeData(
  candles: CandleData[]
): { time: number; value: number; color: string }[] {
  return candles.map((candle) => ({
    time: candle.time,
    value: candle.volume || 0,
    color: candle.close >= candle.open ? '#00d26a80' : '#ff475780', // Semi-transparent
  }));
}
