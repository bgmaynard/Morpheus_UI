/**
 * Stats Panel - Daily Statistics Dashboard
 *
 * Shows trading stats, rejection breakdown, and recent trades.
 * Data comes from /api/stats endpoints.
 */

import { ComponentContainer } from 'golden-layout';
import { useEffect, useState, useCallback } from 'react';
import { getAPIClient, TodayStatsResponse, TradeData, WatchlistItem } from '../morpheus/apiClient';
import './panels.css';

interface Props {
  container: ComponentContainer;
}

type TabId = 'overview' | 'rejections' | 'trades' | 'scanner';

export function StatsPanel({ container }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [stats, setStats] = useState<TodayStatsResponse | null>(null);
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const client = getAPIClient();

    try {
      // Fetch all data in parallel
      const [statsRes, tradesRes, watchlistRes] = await Promise.allSettled([
        client.getTodayStats(),
        client.getTrades(20),
        client.getScannerWatchlist(),
      ]);

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
      }
      if (tradesRes.status === 'fulfilled') {
        setTrades(tradesRes.value.trades || []);
      }
      if (watchlistRes.status === 'fulfilled') {
        setWatchlist(watchlistRes.value.watchlist || []);
      }

      setLastUpdate(new Date());
    } catch (err) {
      console.error('[STATS] Failed to fetch data:', err);
      setError('Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount and refresh every 30 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const formatMoney = (value: number) => {
    return `${value >= 0 ? '+' : ''}$${value.toFixed(2)}`;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="morpheus-panel stats-panel">
      <div className="morpheus-panel-header">
        <span className="panel-title">Stats Dashboard</span>
        <div className="stats-controls">
          {lastUpdate && (
            <span className="last-update">
              {lastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button className="btn btn-tiny" onClick={fetchData} disabled={isLoading}>
            {isLoading ? '...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="stats-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'rejections' ? 'active' : ''}`}
          onClick={() => setActiveTab('rejections')}
        >
          Rejections
        </button>
        <button
          className={`tab-btn ${activeTab === 'trades' ? 'active' : ''}`}
          onClick={() => setActiveTab('trades')}
        >
          Trades
        </button>
        <button
          className={`tab-btn ${activeTab === 'scanner' ? 'active' : ''}`}
          onClick={() => setActiveTab('scanner')}
        >
          Scanner
        </button>
      </div>

      <div className="morpheus-panel-content">
        {error ? (
          <div className="empty-message">{error}</div>
        ) : activeTab === 'overview' ? (
          <OverviewTab stats={stats} isLoading={isLoading} />
        ) : activeTab === 'rejections' ? (
          <RejectionsTab stats={stats} isLoading={isLoading} />
        ) : activeTab === 'trades' ? (
          <TradesTab trades={trades} isLoading={isLoading} formatMoney={formatMoney} formatPercent={formatPercent} formatTime={formatTime} />
        ) : (
          <ScannerTab watchlist={watchlist} isLoading={isLoading} formatPercent={formatPercent} />
        )}
      </div>
    </div>
  );
}

// Overview Tab
function OverviewTab({ stats, isLoading }: { stats: TodayStatsResponse | null; isLoading: boolean }) {
  if (isLoading && !stats) {
    return <div className="empty-message">Loading stats...</div>;
  }

  if (!stats) {
    return <div className="empty-message">No stats available</div>;
  }

  return (
    <div className="stats-overview">
      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Signals</div>
          <div className="stat-value">{stats.signals_detected}</div>
          <div className="stat-sub">{stats.signals_rejected} rejected</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Trades</div>
          <div className="stat-value">{stats.trades_total}</div>
          <div className="stat-sub">{stats.trades_closed} closed</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Win Rate</div>
          <div className={`stat-value ${stats.win_rate >= 50 ? 'text-success' : stats.win_rate > 0 ? 'text-warning' : ''}`}>
            {stats.win_rate.toFixed(1)}%
          </div>
          <div className="stat-sub">{stats.trades_won}W / {stats.trades_lost}L</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">P&L</div>
          <div className={`stat-value ${stats.total_pnl >= 0 ? 'text-success' : 'text-danger'}`}>
            {stats.total_pnl >= 0 ? '+' : ''}${stats.total_pnl.toFixed(2)}
          </div>
          <div className="stat-sub">today</div>
        </div>
      </div>

      {/* Quick Rejection Summary */}
      {Object.keys(stats.top_rejection_reasons).length > 0 && (
        <div className="stats-section">
          <div className="section-header">Top Rejection Reasons</div>
          <div className="rejection-bars">
            {Object.entries(stats.top_rejection_reasons)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3)
              .map(([reason, count]) => (
                <div key={reason} className="rejection-bar-item">
                  <span className="rejection-reason">{formatRejectionReason(reason)}</span>
                  <span className="rejection-count">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Rejections Tab
function RejectionsTab({ stats, isLoading }: { stats: TodayStatsResponse | null; isLoading: boolean }) {
  if (isLoading && !stats) {
    return <div className="empty-message">Loading...</div>;
  }

  const rejections = stats?.top_rejection_reasons || {};
  const total = Object.values(rejections).reduce((a, b) => a + b, 0);

  if (total === 0) {
    return <div className="empty-message">No rejections today</div>;
  }

  return (
    <div className="rejections-list">
      <div className="rejections-header">
        <span>Reason</span>
        <span>Count</span>
        <span>%</span>
      </div>
      {Object.entries(rejections)
        .sort(([, a], [, b]) => b - a)
        .map(([reason, count]) => (
          <div key={reason} className="rejection-row">
            <span className="rejection-reason">{formatRejectionReason(reason)}</span>
            <span className="rejection-count">{count}</span>
            <span className="rejection-pct">{((count / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      <div className="rejections-total">
        <span>Total</span>
        <span>{total}</span>
        <span>100%</span>
      </div>
    </div>
  );
}

// Trades Tab
function TradesTab({
  trades,
  isLoading,
  formatMoney,
  formatPercent,
  formatTime,
}: {
  trades: TradeData[];
  isLoading: boolean;
  formatMoney: (v: number) => string;
  formatPercent: (v: number) => string;
  formatTime: (t: string) => string;
}) {
  if (isLoading && trades.length === 0) {
    return <div className="empty-message">Loading trades...</div>;
  }

  if (trades.length === 0) {
    return <div className="empty-message">No trades today</div>;
  }

  return (
    <div className="trades-table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Symbol</th>
            <th>Dir</th>
            <th className="text-right">Entry</th>
            <th className="text-right">Exit</th>
            <th className="text-right">P&L</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.trade_id}>
              <td className="time-cell">{formatTime(trade.entry_time)}</td>
              <td className="symbol-cell">{trade.symbol}</td>
              <td>
                <span className={`direction-badge-small ${trade.direction}`}>
                  {trade.direction.toUpperCase()}
                </span>
              </td>
              <td className="text-right">{trade.entry_price?.toFixed(2) || '-'}</td>
              <td className="text-right">{trade.exit_price?.toFixed(2) || '-'}</td>
              <td className={`text-right ${(trade.pnl || 0) >= 0 ? 'text-long' : 'text-short'}`}>
                {trade.pnl != null ? formatMoney(trade.pnl) : '-'}
              </td>
              <td>
                <span className={`status-badge ${trade.status.toLowerCase()}`}>
                  {trade.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Scanner Tab
function ScannerTab({
  watchlist,
  isLoading,
  formatPercent,
}: {
  watchlist: WatchlistItem[];
  isLoading: boolean;
  formatPercent: (v: number) => string;
}) {
  if (isLoading && watchlist.length === 0) {
    return <div className="empty-message">Loading scanner...</div>;
  }

  if (watchlist.length === 0) {
    return <div className="empty-message">Scanner watchlist empty</div>;
  }

  return (
    <div className="scanner-table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>State</th>
            <th className="text-right">RVOL</th>
            <th className="text-right">Chg%</th>
            <th className="text-right">Score</th>
          </tr>
        </thead>
        <tbody>
          {watchlist.map((item) => (
            <tr key={item.symbol}>
              <td className="symbol-cell">{item.symbol}</td>
              <td>
                <span className={`state-badge ${item.state.toLowerCase()}`}>
                  {item.state}
                </span>
              </td>
              <td className="text-right">{item.rvol?.toFixed(1) || '-'}x</td>
              <td className={`text-right ${(item.change_pct || 0) >= 0 ? 'text-long' : 'text-short'}`}>
                {item.change_pct != null ? formatPercent(item.change_pct) : '-'}
              </td>
              <td className="text-right">{item.score?.toFixed(0) || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Helper function to format rejection reason codes
function formatRejectionReason(reason: string): string {
  const reasonMap: Record<string, string> = {
    low_confidence: 'Low Confidence',
    regime_mismatch: 'Regime Mismatch',
    feature_quality: 'Feature Quality',
    warmup_incomplete: 'Warmup Incomplete',
    market_closed: 'Market Closed',
    volatility_extreme: 'Extreme Volatility',
    conflicting_signals: 'Conflicting Signals',
    rate_limited: 'Rate Limited',
    model_uncertainty: 'Model Uncertainty',
    manual_block: 'Manual Block',
    max_position_size: 'Max Position Size',
    max_daily_loss: 'Max Daily Loss',
    max_drawdown: 'Max Drawdown',
    max_open_positions: 'Max Open Positions',
    max_sector_exposure: 'Max Exposure',
    kill_switch_active: 'Kill Switch',
    insufficient_buying_power: 'Insufficient BP',
    insufficient_room_to_profit: 'No Room to Profit',
  };
  return reasonMap[reason] || reason.replace(/_/g, ' ');
}
