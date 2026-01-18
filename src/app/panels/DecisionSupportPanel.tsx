/**
 * Decision Support Panel - Human Confirmation Entry (Compact)
 *
 * Displays current Morpheus state for the active symbol to support
 * tape-synchronized human confirmation of entries.
 *
 * Compact 3-row layout:
 * - Row 1: READY/BLOCKED badge + Countdown
 * - Row 2: Symbol | Direction | Block reasons (inline chips)
 * - Row 3: Compact confirm button
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
const CONFIRM_TTL_MS = 1200;
const SIGNAL_ARMED_THRESHOLD = 800;
const SIGNAL_EXPIRING_THRESHOLD = CONFIRM_TTL_MS;

// Countdown color thresholds
const COUNTDOWN_GREEN_THRESHOLD = 800;
const COUNTDOWN_YELLOW_THRESHOLD = 400;

type SignalStatus = 'NONE' | 'ARMED' | 'EXPIRING' | 'STALE';
type ExecutionState = 'BLOCKED' | 'READY';

interface BlockReason {
  code: string;
  message: string;
}

export function DecisionSupportPanel({ container: _container }: Props) {
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
  const [signalStatus, setSignalStatus] = useState<SignalStatus>('NONE');
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const [confirmResult, setConfirmResult] = useState<{ success: boolean; message: string } | null>(null);

  // Update signal age every 100ms
  useEffect(() => {
    if (!decisionChain?.signal?.timestamp) {
      setSignalStatus('NONE');
      setCountdownRemaining(null);
      return;
    }

    const updateAge = () => {
      const signalTime = new Date(decisionChain.signal!.timestamp).getTime();
      const age = Date.now() - signalTime;

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

    if (!activeChain.symbol) {
      reasons.push({ code: 'NO_SYMBOL', message: 'No symbol' });
    }

    if (!decisionChain?.signal) {
      reasons.push({ code: 'NO_SIGNAL', message: 'No signal' });
    }

    if (signalStatus === 'STALE') {
      reasons.push({ code: 'SIGNAL_STALE', message: 'Expired' });
    }

    if (decisionChain?.gate?.decision === 'rejected') {
      reasons.push({ code: 'GATE_REJECTED', message: 'Gate rejected' });
    }

    if (decisionChain?.risk?.decision === 'vetoed') {
      reasons.push({ code: 'RISK_VETOED', message: 'Risk vetoed' });
    }

    if (decisionChain?.guard?.decision === 'block') {
      reasons.push({ code: 'GUARD_BLOCKED', message: 'Guard blocked' });
    }

    if (trading.mode === 'LIVE' && !trading.liveArmed) {
      reasons.push({ code: 'NOT_ARMED', message: 'Not armed' });
    }

    if (trading.killSwitchActive) {
      reasons.push({ code: 'KILL_SWITCH', message: 'Kill switch' });
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

      addPendingCommand({
        command_id: result.command_id,
        command_type: 'CONFIRM_ENTRY',
        timestamp: Date.now(),
        symbol: activeChain.symbol,
      });

      setConfirmResult({
        success: result.accepted,
        message: result.accepted ? 'Sent' : (result.message || 'Rejected'),
      });
    } catch (error) {
      setConfirmResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed',
      });
    } finally {
      setConfirmPending(false);
    }
  }, [executionState, decisionChain, activeChain, addPendingCommand]);

  // Format countdown for display
  const formatCountdown = (ms: number | null): string => {
    if (ms === null) return '--';
    if (ms <= 0) return '0.0s';
    return (ms / 1000).toFixed(1) + 's';
  };

  // Get countdown color class
  const getCountdownColor = (ms: number | null): string => {
    if (ms === null || ms <= 0) return 'countdown-expired';
    if (ms > COUNTDOWN_GREEN_THRESHOLD) return 'countdown-green';
    if (ms > COUNTDOWN_YELLOW_THRESHOLD) return 'countdown-yellow';
    return 'countdown-red';
  };

  return (
    <div className="morpheus-panel decision-support-panel-compact">
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
          <div className="empty-message">Select a symbol</div>
        ) : (
          <div className="dsc-content">
            {/* Row 1: State Badge + Countdown */}
            <div className="dsc-row dsc-row-primary">
              <div className={`dsc-state-badge ${executionState.toLowerCase()}`}>
                {executionState}
              </div>
              <div className="dsc-countdown">
                <span className="dsc-countdown-label">TTL</span>
                <span className={`dsc-countdown-value ${getCountdownColor(countdownRemaining)}`}>
                  {formatCountdown(countdownRemaining)}
                </span>
              </div>
            </div>

            {/* Row 2: Symbol | Direction | Block Reasons */}
            <div className="dsc-row dsc-row-info">
              <span className="dsc-symbol">{activeChain.symbol}</span>
              <span className={`dsc-direction ${decisionChain?.signal?.direction || 'none'}`}>
                {decisionChain?.signal?.direction?.toUpperCase() || '--'}
              </span>
              <div className="dsc-reasons">
                {blockReasons.slice(0, 3).map((reason) => (
                  <span key={reason.code} className="dsc-reason-chip">
                    {reason.message}
                  </span>
                ))}
                {blockReasons.length > 3 && (
                  <span className="dsc-reason-chip dsc-reason-more">
                    +{blockReasons.length - 3}
                  </span>
                )}
              </div>
            </div>

            {/* Row 3: Confirm Button */}
            <div className="dsc-row dsc-row-action">
              <button
                className={`dsc-confirm-btn ${executionState === 'READY' ? 'ready' : 'blocked'}`}
                onClick={handleConfirmEntry}
                disabled={executionState !== 'READY' || confirmPending}
              >
                {confirmPending ? 'CONFIRMING...' : 'CONFIRM ENTRY'}
              </button>
              {confirmResult && (
                <span className={`dsc-result ${confirmResult.success ? 'success' : 'error'}`}>
                  {confirmResult.message}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
