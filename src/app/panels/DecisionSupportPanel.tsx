/**
 * Decision Support Panel - Human Confirmation Entry
 *
 * Displays current Morpheus state for the active symbol to support
 * tape-synchronized human confirmation of entries.
 *
 * IMPORTANT: This panel displays ONLY existing Morpheus state.
 * No market data. No L2. No inference.
 *
 * The human reads tape in Thinkorswim, sees "READY" here,
 * presses CONFIRM ENTRY, and Morpheus executes immediately
 * (or blocks with a clear reason).
 */

import { ComponentContainer } from 'golden-layout';
import { useEffect, useState, useCallback, KeyboardEvent } from 'react';
import { useActiveChain, useDecisionChain, useTrading, useAppStore } from '../store/useAppStore';
import { getAPIClient, ConfirmEntryPayload } from '../morpheus/apiClient';
import './panels.css';

interface Props {
  container: ComponentContainer;
}

// Signal status thresholds (milliseconds)
// SMALL-CAP MOMENTUM OPTIMIZED:
// - TTL 1200ms: Breakouts valid after 2-3s usually aren't the move
// - Must match Morpheus_AI ConfirmationGuardConfig
const CONFIRM_TTL_MS = 1200;             // 1.2 seconds (small-cap optimized)
const SIGNAL_ARMED_THRESHOLD = 800;      // < 800ms = ARMED (green)
const SIGNAL_EXPIRING_THRESHOLD = CONFIRM_TTL_MS; // >= TTL = STALE

// Countdown color thresholds
const COUNTDOWN_GREEN_THRESHOLD = 800;   // > 800ms = green
const COUNTDOWN_YELLOW_THRESHOLD = 400;  // 400-800ms = yellow, < 400ms = red

type SignalStatus = 'NONE' | 'ARMED' | 'EXPIRING' | 'STALE';
type ExecutionState = 'BLOCKED' | 'READY';

interface BlockReason {
  code: string;
  message: string;
}

export function DecisionSupportPanel({ container }: Props) {
  const activeChain = useActiveChain();
  const activeChainId = useAppStore((s) => s.activeChainId);
  const setChainSymbol = useAppStore((s) => s.setChainSymbol);
  const decisionChain = useDecisionChain(activeChain.symbol);
  const trading = useTrading();
  const addPendingCommand = useAppStore((s) => s.addPendingCommand);

  // Symbol input state
  const [symbolInput, setSymbolInput] = useState(activeChain.symbol || '');

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

  // Real-time signal age tracking
  const [signalAge, setSignalAge] = useState<number | null>(null);
  const [signalStatus, setSignalStatus] = useState<SignalStatus>('NONE');
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const [confirmResult, setConfirmResult] = useState<{ success: boolean; message: string } | null>(null);

  // Update signal age every 100ms
  useEffect(() => {
    if (!decisionChain?.signal?.timestamp) {
      setSignalAge(null);
      setSignalStatus('NONE');
      setCountdownRemaining(null);
      return;
    }

    const updateAge = () => {
      const signalTime = new Date(decisionChain.signal!.timestamp).getTime();
      const age = Date.now() - signalTime;
      setSignalAge(age);

      // Calculate countdown remaining
      const remaining = CONFIRM_TTL_MS - age;
      setCountdownRemaining(remaining > 0 ? remaining : 0);

      if (age < SIGNAL_ARMED_THRESHOLD) {
        setSignalStatus('ARMED');
      } else if (age < SIGNAL_EXPIRING_THRESHOLD) {
        setSignalStatus('EXPIRING');
      } else {
        setSignalStatus('STALE');
      }
    };

    updateAge();
    const interval = setInterval(updateAge, 100);

    return () => clearInterval(interval);
  }, [decisionChain?.signal?.timestamp]);

  // Clear confirm result after 3 seconds
  useEffect(() => {
    if (confirmResult) {
      const timeout = setTimeout(() => setConfirmResult(null), 3000);
      return () => clearTimeout(timeout);
    }
  }, [confirmResult]);

  // Determine execution state and block reasons
  const getExecutionState = useCallback((): { state: ExecutionState; reasons: BlockReason[] } => {
    const reasons: BlockReason[] = [];

    // No symbol
    if (!activeChain.symbol) {
      reasons.push({ code: 'NO_SYMBOL', message: 'No symbol selected' });
    }

    // No signal
    if (!decisionChain?.signal) {
      reasons.push({ code: 'NO_SIGNAL', message: 'No active signal' });
    }

    // Signal stale
    if (signalStatus === 'STALE') {
      reasons.push({ code: 'SIGNAL_STALE', message: 'Signal expired (>4s)' });
    }

    // Gate rejected
    if (decisionChain?.gate?.decision === 'rejected') {
      reasons.push({ code: 'GATE_REJECTED', message: 'Gate rejected signal' });
    }

    // Risk vetoed
    if (decisionChain?.risk?.decision === 'vetoed') {
      reasons.push({ code: 'RISK_VETOED', message: 'Risk vetoed signal' });
    }

    // Guard blocked
    if (decisionChain?.guard?.decision === 'block') {
      reasons.push({ code: 'GUARD_BLOCKED', message: 'Guard blocked execution' });
    }

    // Live mode but not armed
    if (trading.mode === 'LIVE' && !trading.liveArmed) {
      reasons.push({ code: 'NOT_ARMED', message: 'Live trading not armed' });
    }

    // Kill switch active
    if (trading.killSwitchActive) {
      reasons.push({ code: 'KILL_SWITCH', message: 'Kill switch active' });
    }

    return {
      state: reasons.length === 0 ? 'READY' : 'BLOCKED',
      reasons,
    };
  }, [activeChain.symbol, decisionChain, signalStatus, trading]);

  const { state: executionState, reasons: blockReasons } = getExecutionState();

  // Handle confirm entry
  const handleConfirmEntry = useCallback(async () => {
    if (executionState !== 'READY' || !decisionChain?.signal || !activeChain.symbol) {
      return;
    }

    setConfirmPending(true);
    setConfirmResult(null);

    try {
      const payload: ConfirmEntryPayload = {
        symbol: activeChain.symbol,
        chain_id: activeChain.id,
        signal_timestamp: decisionChain.signal.timestamp,
        entry_price: decisionChain.signal.entry_price || 0,
      };

      const client = getAPIClient();
      const result = await client.confirmEntry(payload);

      // Track pending command
      addPendingCommand({
        command_id: result.command_id,
        command_type: 'CONFIRM_ENTRY',
        timestamp: Date.now(),
        symbol: activeChain.symbol,
      });

      setConfirmResult({
        success: result.accepted,
        message: result.accepted ? 'Confirmation sent' : (result.message || 'Rejected'),
      });
    } catch (error) {
      setConfirmResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send',
      });
    } finally {
      setConfirmPending(false);
    }
  }, [executionState, decisionChain, activeChain, addPendingCommand]);

  // Format signal age for display
  const formatAge = (ms: number | null): string => {
    if (ms === null) return '--';
    return (ms / 1000).toFixed(1) + 's';
  };

  // Format countdown for display
  const formatCountdown = (ms: number | null): string => {
    if (ms === null) return '--';
    if (ms <= 0) return 'EXPIRED';
    return (ms / 1000).toFixed(1) + 's';
  };

  // Get countdown color class
  const getCountdownColor = (ms: number | null): string => {
    if (ms === null || ms <= 0) return 'countdown-expired';
    if (ms > COUNTDOWN_GREEN_THRESHOLD) return 'countdown-green';
    if (ms > COUNTDOWN_YELLOW_THRESHOLD) return 'countdown-yellow';
    return 'countdown-red';
  };

  // Format price for display
  const formatPrice = (price: number | undefined): string => {
    if (price === undefined || price === 0) return '--';
    return price.toFixed(2);
  };

  return (
    <div className="morpheus-panel decision-support-panel">
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
        </span>
        <div className={`mode-indicator ${trading.mode.toLowerCase()}`}>
          {trading.mode}
          {trading.mode === 'LIVE' && trading.liveArmed && (
            <span className="armed-indicator">ARMED</span>
          )}
        </div>
      </div>

      <div className="morpheus-panel-content">
        {!activeChain.symbol ? (
          <div className="empty-message">Select a symbol to view decision support</div>
        ) : (
          <div className="decision-support-content">
            {/* Symbol & Strategy */}
            <div className="ds-section">
              <div className="ds-row">
                <span className="ds-label">Symbol</span>
                <span className="ds-value ds-symbol">{activeChain.symbol}</span>
              </div>
              <div className="ds-row">
                <span className="ds-label">Strategy</span>
                <span className="ds-value">{decisionChain?.signal?.strategy_name || '--'}</span>
              </div>
              <div className="ds-row">
                <span className="ds-label">Regime</span>
                <span className="ds-value">{decisionChain?.regime?.regime || '--'}</span>
              </div>
            </div>

            {/* Signal Status */}
            <div className="ds-section ds-signal-section">
              <div className="ds-row">
                <span className="ds-label">Signal</span>
                <span className={`ds-value ds-signal-status ${signalStatus.toLowerCase()}`}>
                  {signalStatus}
                </span>
              </div>
              <div className="ds-row">
                <span className="ds-label">Direction</span>
                <span className={`ds-value ds-direction ${decisionChain?.signal?.direction || ''}`}>
                  {decisionChain?.signal?.direction?.toUpperCase() || '--'}
                </span>
              </div>
            </div>

            {/* Confirm Window Countdown - PROMINENT */}
            <div className="ds-section ds-countdown-section">
              <div className="ds-countdown-label">CONFIRM WINDOW</div>
              <div className={`ds-countdown-value ${getCountdownColor(countdownRemaining)}`}>
                {formatCountdown(countdownRemaining)}
              </div>
            </div>

            {/* Price Levels */}
            <div className="ds-section">
              <div className="ds-row">
                <span className="ds-label">Entry</span>
                <span className="ds-value ds-price">{formatPrice(decisionChain?.signal?.entry_price)}</span>
              </div>
              <div className="ds-row">
                <span className="ds-label">Stop</span>
                <span className="ds-value ds-price ds-stop">{formatPrice(decisionChain?.signal?.stop_price)}</span>
              </div>
              <div className="ds-row">
                <span className="ds-label">Target</span>
                <span className="ds-value ds-price ds-target">{formatPrice(decisionChain?.signal?.target_price)}</span>
              </div>
            </div>

            {/* Position Size */}
            <div className="ds-section">
              <div className="ds-row">
                <span className="ds-label">Size</span>
                <span className="ds-value ds-size">
                  {decisionChain?.risk?.position_size?.shares || '--'} shares
                </span>
              </div>
            </div>

            {/* Execution State */}
            <div className="ds-section ds-execution-section">
              <div className={`ds-execution-state ${executionState.toLowerCase()}`}>
                {executionState}
              </div>
              {blockReasons.length > 0 && (
                <div className="ds-block-reasons">
                  {blockReasons.map((reason) => (
                    <div key={reason.code} className="ds-block-reason">
                      {reason.message}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm Button */}
            <div className="ds-section ds-confirm-section">
              <button
                className={`ds-confirm-btn ${executionState === 'READY' ? 'ready' : 'blocked'}`}
                onClick={handleConfirmEntry}
                disabled={executionState !== 'READY' || confirmPending}
              >
                {confirmPending ? 'CONFIRMING...' : 'CONFIRM ENTRY'}
              </button>
              <div className="ds-hotkey-hint">
                Hotkey: <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
              </div>
              {confirmResult && (
                <div className={`ds-confirm-result ${confirmResult.success ? 'success' : 'error'}`}>
                  {confirmResult.message}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
