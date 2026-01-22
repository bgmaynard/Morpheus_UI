/**
 * Orchestrator Monitor Panel - Pipeline decision monitoring
 *
 * Shows:
 * - Pipeline status and warmup progress
 * - Recent signals, scores, gate/risk decisions
 * - Event counts and statistics
 */

import { ComponentContainer } from 'golden-layout';
import { useState, useEffect, useCallback } from 'react';
import './panels.css';

interface Props {
  container: ComponentContainer;
}

interface WarmupStatus {
  bars: number;
  complete: boolean;
}

interface PipelineStatus {
  active_symbols: string[];
  kill_switch_active: boolean;
  permissive_mode: boolean;
  registered_strategies: string[];
  warmup_status: Record<string, WarmupStatus>;
}

interface PipelineEvent {
  event_id: string;
  event_type: string;
  timestamp: string;
  symbol?: string;
  payload: Record<string, unknown>;
}

interface EventCounts {
  total: number;
  signals: number;
  approved: number;
  rejected: number;
  risk_approved: number;
  risk_vetoed: number;
}

interface MonitorData {
  enabled: boolean;
  message?: string;
  status?: PipelineStatus;
  recent_events?: {
    signals: PipelineEvent[];
    scores: PipelineEvent[];
    gate_decisions: PipelineEvent[];
    risk_decisions: PipelineEvent[];
    regime_detections: PipelineEvent[];
  };
  event_counts?: EventCounts;
}

type TabType = 'status' | 'signals' | 'decisions' | 'regime';

export function OrchestratorPanel({ container }: Props) {
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('status');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8010/api/pipeline/monitor');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, 2000);
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh]);

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const renderStatusTab = () => {
    if (!data?.status) return <div className="empty-message">No status data</div>;

    const { status, event_counts } = data;

    return (
      <div className="orchestrator-status">
        {/* Pipeline State */}
        <div className="status-section">
          <div className="section-header">Pipeline State</div>
          <div className="status-grid">
            <div className="status-item">
              <span className="status-label">Mode</span>
              <span className={`status-value ${status.permissive_mode ? 'text-warning' : 'text-success'}`}>
                {status.permissive_mode ? 'PERMISSIVE' : 'STANDARD'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">Kill Switch</span>
              <span className={`status-value ${status.kill_switch_active ? 'text-danger' : 'text-success'}`}>
                {status.kill_switch_active ? 'ACTIVE' : 'OFF'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">Symbols</span>
              <span className="status-value">{status.active_symbols.length}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Strategies</span>
              <span className="status-value">{status.registered_strategies.length}</span>
            </div>
          </div>
        </div>

        {/* Event Counts */}
        {event_counts && (
          <div className="status-section">
            <div className="section-header">Event Counts (Session)</div>
            <div className="status-grid">
              <div className="status-item">
                <span className="status-label">Signals</span>
                <span className="status-value text-info">{event_counts.signals}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Approved</span>
                <span className="status-value text-success">{event_counts.approved}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Rejected</span>
                <span className="status-value text-danger">{event_counts.rejected}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Risk OK</span>
                <span className="status-value text-success">{event_counts.risk_approved}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Risk Veto</span>
                <span className="status-value text-danger">{event_counts.risk_vetoed}</span>
              </div>
            </div>
          </div>
        )}

        {/* Warmup Status */}
        <div className="status-section">
          <div className="section-header">Symbol Warmup</div>
          {status.active_symbols.length === 0 ? (
            <div className="empty-message">No symbols subscribed</div>
          ) : (
            <div className="warmup-list">
              {status.active_symbols.map((symbol) => {
                const warmup = status.warmup_status[symbol] || { bars: 0, complete: false };
                const progress = Math.min(100, (warmup.bars / 50) * 100);
                return (
                  <div key={symbol} className="warmup-item">
                    <span className="warmup-symbol">{symbol}</span>
                    <div className="warmup-bar">
                      <div
                        className={`warmup-progress ${warmup.complete ? 'complete' : ''}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className={`warmup-status ${warmup.complete ? 'text-success' : 'text-warning'}`}>
                      {warmup.complete ? 'READY' : `${warmup.bars}/50`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Registered Strategies */}
        <div className="status-section">
          <div className="section-header">Registered Strategies</div>
          <div className="strategy-list">
            {status.registered_strategies.map((strategy) => (
              <span key={strategy} className="strategy-badge">{strategy}</span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderSignalsTab = () => {
    const signals = data?.recent_events?.signals || [];
    const scores = data?.recent_events?.scores || [];

    return (
      <div className="orchestrator-events">
        <div className="events-section">
          <div className="section-header">Recent Signals</div>
          {signals.length === 0 ? (
            <div className="empty-message">No signals yet</div>
          ) : (
            <div className="event-list">
              {signals.map((event) => (
                <div key={event.event_id} className="event-card signal-card">
                  <div className="event-header">
                    <span className="event-time">{formatTime(event.timestamp)}</span>
                    <span className="event-symbol">{event.symbol}</span>
                    <span className={`direction-badge ${(event.payload.direction as string)?.toLowerCase()}`}>
                      {(event.payload.direction as string) || 'N/A'}
                    </span>
                  </div>
                  <div className="event-details">
                    <span className="strategy-name">{event.payload.strategy_name as string}</span>
                    <span className="rationale">{(event.payload.rationale as string)?.substring(0, 80)}...</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="events-section">
          <div className="section-header">Recent Scores</div>
          {scores.length === 0 ? (
            <div className="empty-message">No scores yet</div>
          ) : (
            <div className="event-list">
              {scores.map((event) => (
                <div key={event.event_id} className="event-card score-card">
                  <div className="event-header">
                    <span className="event-time">{formatTime(event.timestamp)}</span>
                    <span className="event-symbol">{event.symbol}</span>
                    <span className="confidence-badge">
                      {((event.payload.confidence as number) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="event-details">
                    <span className="score-rationale">{(event.payload.score_rationale as string)?.substring(0, 100)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDecisionsTab = () => {
    const gateDecisions = data?.recent_events?.gate_decisions || [];
    const riskDecisions = data?.recent_events?.risk_decisions || [];

    return (
      <div className="orchestrator-events">
        <div className="events-section">
          <div className="section-header">Gate Decisions</div>
          {gateDecisions.length === 0 ? (
            <div className="empty-message">No gate decisions yet</div>
          ) : (
            <div className="event-list">
              {gateDecisions.map((event) => {
                const isApproved = event.event_type === 'META_APPROVED';
                return (
                  <div key={event.event_id} className={`event-card gate-card ${isApproved ? 'approved' : 'rejected'}`}>
                    <div className="event-header">
                      <span className="event-time">{formatTime(event.timestamp)}</span>
                      <span className="event-symbol">{event.symbol}</span>
                      <span className={`decision-badge ${isApproved ? 'approved' : 'rejected'}`}>
                        {isApproved ? 'APPROVED' : 'REJECTED'}
                      </span>
                    </div>
                    <div className="event-details">
                      <span>{event.payload.gate_name as string}</span>
                      {event.payload.reason_details && (
                        <span className="reason">{event.payload.reason_details as string}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="events-section">
          <div className="section-header">Risk Decisions</div>
          {riskDecisions.length === 0 ? (
            <div className="empty-message">No risk decisions yet</div>
          ) : (
            <div className="event-list">
              {riskDecisions.map((event) => {
                const isApproved = event.event_type === 'RISK_APPROVED';
                const payload = event.payload as Record<string, unknown>;
                const positionSize = payload.position_size as Record<string, unknown> | undefined;
                return (
                  <div key={event.event_id} className={`event-card risk-card ${isApproved ? 'approved' : 'rejected'}`}>
                    <div className="event-header">
                      <span className="event-time">{formatTime(event.timestamp)}</span>
                      <span className="event-symbol">{event.symbol}</span>
                      <span className={`decision-badge ${isApproved ? 'approved' : 'rejected'}`}>
                        {isApproved ? 'APPROVED' : 'VETOED'}
                      </span>
                    </div>
                    <div className="event-details">
                      {isApproved && positionSize && (
                        <span className="position-info">
                          {positionSize.shares} shares @ ${positionSize.entry_price}
                        </span>
                      )}
                      {!isApproved && payload.reason_details && (
                        <span className="reason">{payload.reason_details as string}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRegimeTab = () => {
    const regimeDetections = data?.recent_events?.regime_detections || [];

    return (
      <div className="orchestrator-events">
        <div className="events-section">
          <div className="section-header">Recent Regime Detections</div>
          {regimeDetections.length === 0 ? (
            <div className="empty-message">No regime detections yet</div>
          ) : (
            <div className="event-list">
              {regimeDetections.map((event) => {
                const payload = event.payload as Record<string, unknown>;
                return (
                  <div key={event.event_id} className="event-card regime-card">
                    <div className="event-header">
                      <span className="event-time">{formatTime(event.timestamp)}</span>
                      <span className="event-symbol">{event.symbol}</span>
                    </div>
                    <div className="regime-grid">
                      <div className="regime-item">
                        <span className="regime-label">Trend</span>
                        <span className="regime-value">{payload.trend as string}</span>
                      </div>
                      <div className="regime-item">
                        <span className="regime-label">Volatility</span>
                        <span className="regime-value">{payload.volatility as string}</span>
                      </div>
                      <div className="regime-item">
                        <span className="regime-label">Momentum</span>
                        <span className="regime-value">{payload.momentum as string}</span>
                      </div>
                      <div className="regime-item">
                        <span className="regime-label">Confidence</span>
                        <span className="regime-value">{((payload.confidence as number) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="regime-composite">
                      <span className="composite-label">Composite:</span>
                      <span className="composite-value">{payload.composite_regime as string}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="morpheus-panel orchestrator-panel">
      <div className="morpheus-panel-header">
        <span className="panel-title">Orchestrator Monitor</span>
        <div className="orchestrator-controls">
          <label className="autoscroll-label">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto
          </label>
          <button className="btn btn-small" onClick={fetchData} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="orchestrator-tabs">
        <button
          className={`tab-btn ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => setActiveTab('status')}
        >
          Status
        </button>
        <button
          className={`tab-btn ${activeTab === 'signals' ? 'active' : ''}`}
          onClick={() => setActiveTab('signals')}
        >
          Signals
        </button>
        <button
          className={`tab-btn ${activeTab === 'decisions' ? 'active' : ''}`}
          onClick={() => setActiveTab('decisions')}
        >
          Decisions
        </button>
        <button
          className={`tab-btn ${activeTab === 'regime' ? 'active' : ''}`}
          onClick={() => setActiveTab('regime')}
        >
          Regime
        </button>
      </div>

      <div className="morpheus-panel-content orchestrator-content">
        {loading && !data ? (
          <div className="empty-message">Loading...</div>
        ) : error ? (
          <div className="empty-message text-danger">Error: {error}</div>
        ) : !data?.enabled ? (
          <div className="empty-message">Pipeline not available: {data?.message}</div>
        ) : (
          <>
            {activeTab === 'status' && renderStatusTab()}
            {activeTab === 'signals' && renderSignalsTab()}
            {activeTab === 'decisions' && renderDecisionsTab()}
            {activeTab === 'regime' && renderRegimeTab()}
          </>
        )}
      </div>
    </div>
  );
}
