/**
 * Morpheus Decision Panel - Decision chain visualization
 *
 * Shows the current decision chain for the active symbol:
 * Signal -> Score -> Gate -> Risk -> Guard -> Execution
 */

import { ComponentContainer } from 'golden-layout';
import { useActiveChain, useDecisionChain } from '../store/useAppStore';
import './panels.css';

interface Props {
  container: ComponentContainer;
}

export function MorpheusDecisionPanel({ container }: Props) {
  const activeChain = useActiveChain();
  const decisionChain = useDecisionChain(activeChain.symbol);

  const formatTime = (ts: string | undefined) => {
    if (!ts) return '--:--:--';
    return new Date(ts).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="morpheus-panel">
      <div className="morpheus-panel-header">
        <span className="panel-title">
          <span className="chain-indicator" style={{ backgroundColor: activeChain.color }} />
          Morpheus Decision
        </span>
        <span className="text-muted">{activeChain.symbol || 'No Symbol'}</span>
      </div>
      <div className="morpheus-panel-content decision-panel">
        {!activeChain.symbol ? (
          <div className="empty-message">Select a symbol to view decision chain</div>
        ) : !decisionChain ? (
          <div className="empty-message">Waiting for signals on {activeChain.symbol}...</div>
        ) : (
          <div className="decision-chain">
            {/* Signal Stage */}
            <div className={`decision-stage ${decisionChain.signal ? 'active' : ''}`}>
              <div className="stage-header">
                <span className="stage-icon">📡</span>
                <span className="stage-name">Signal</span>
                <span className="stage-time">{formatTime(decisionChain.signal?.timestamp)}</span>
              </div>
              {decisionChain.signal ? (
                <div className="stage-content">
                  <div
                    className={`direction-badge ${decisionChain.signal.direction}`}
                  >
                    {decisionChain.signal.direction.toUpperCase()}
                  </div>
                  <div className="stage-detail">
                    Strategy: {decisionChain.signal.strategy_name}
                  </div>
                </div>
              ) : (
                <div className="stage-content pending">Waiting...</div>
              )}
            </div>

            {/* Score Stage */}
            <div className={`decision-stage ${decisionChain.score ? 'active' : ''}`}>
              <div className="stage-header">
                <span className="stage-icon">🎯</span>
                <span className="stage-name">Score</span>
                <span className="stage-time">{formatTime(decisionChain.score?.timestamp)}</span>
              </div>
              {decisionChain.score ? (
                <div className="stage-content">
                  <div className="confidence-bar">
                    <div
                      className="confidence-fill"
                      style={{ width: `${decisionChain.score.confidence * 100}%` }}
                    />
                    <span className="confidence-value">
                      {(decisionChain.score.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="stage-detail">{decisionChain.score.rationale}</div>
                </div>
              ) : (
                <div className="stage-content pending">Pending score...</div>
              )}
            </div>

            {/* Gate Stage */}
            <div className={`decision-stage ${decisionChain.gate ? 'active' : ''}`}>
              <div className="stage-header">
                <span className="stage-icon">🚦</span>
                <span className="stage-name">Gate</span>
                <span className="stage-time">{formatTime(decisionChain.gate?.timestamp)}</span>
              </div>
              {decisionChain.gate ? (
                <div className="stage-content">
                  <div
                    className={`decision-badge ${decisionChain.gate.decision}`}
                  >
                    {decisionChain.gate.decision.toUpperCase()}
                  </div>
                  {decisionChain.gate.reasons.length > 0 && (
                    <div className="stage-reasons">
                      {decisionChain.gate.reasons.map((r, i) => (
                        <div key={i} className="reason">{r}</div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="stage-content pending">Pending gate...</div>
              )}
            </div>

            {/* Risk Stage */}
            <div className={`decision-stage ${decisionChain.risk ? 'active' : ''}`}>
              <div className="stage-header">
                <span className="stage-icon">⚖️</span>
                <span className="stage-name">Risk</span>
                <span className="stage-time">{formatTime(decisionChain.risk?.timestamp)}</span>
              </div>
              {decisionChain.risk ? (
                <div className="stage-content">
                  <div
                    className={`decision-badge ${decisionChain.risk.decision}`}
                  >
                    {decisionChain.risk.decision.toUpperCase()}
                  </div>
                  {decisionChain.risk.position_size && (
                    <div className="stage-detail">
                      Size: {decisionChain.risk.position_size.shares} shares
                      ({decisionChain.risk.position_size.notional_value})
                    </div>
                  )}
                  {decisionChain.risk.veto_reasons.length > 0 && (
                    <div className="stage-reasons">
                      {decisionChain.risk.veto_reasons.map((r, i) => (
                        <div key={i} className="reason">{r}</div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="stage-content pending">Pending risk...</div>
              )}
            </div>

            {/* Order Stage */}
            <div className={`decision-stage ${decisionChain.order ? 'active' : ''}`}>
              <div className="stage-header">
                <span className="stage-icon">📋</span>
                <span className="stage-name">Order</span>
                <span className="stage-time">{formatTime(decisionChain.order?.timestamp)}</span>
              </div>
              {decisionChain.order ? (
                <div className="stage-content">
                  <div className={`status-badge ${decisionChain.order.status.toLowerCase()}`}>
                    {decisionChain.order.status}
                  </div>
                  <div className="stage-detail">
                    Filled: {decisionChain.order.filled_quantity}
                  </div>
                </div>
              ) : (
                <div className="stage-content pending">No order yet...</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
