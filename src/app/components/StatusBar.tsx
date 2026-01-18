/**
 * Status Bar - Connection and trading status display
 *
 * Shows WebSocket connection state, event count, and trading mode.
 */

import { useAppStore } from '../store/useAppStore';
import './StatusBar.css';

export function StatusBar() {
  const connection = useAppStore((s) => s.connection);
  const trading = useAppStore((s) => s.trading);

  const formatTime = (date: Date | null) => {
    if (!date) return '--:--:--';
    return date.toLocaleTimeString();
  };

  return (
    <div className="status-bar">
      <div className="status-section">
        <span
          className={`status-indicator ${connection.websocket === 'connected' ? 'connected' : connection.websocket === 'connecting' ? 'connecting' : 'disconnected'}`}
        />
        <span className="status-text">
          {connection.websocket === 'connected'
            ? 'Connected'
            : connection.websocket === 'connecting'
              ? 'Connecting...'
              : 'Disconnected'}
        </span>
      </div>

      <div className="status-section">
        <span className="status-label">Events:</span>
        <span className="status-value">{connection.eventCount.toLocaleString()}</span>
      </div>

      <div className="status-section">
        <span className="status-label">Last:</span>
        <span className="status-value">{formatTime(connection.lastEventTime)}</span>
      </div>

      <div className="status-spacer" />

      <div className="status-section">
        <span
          className={`trading-mode ${trading.mode === 'LIVE' ? 'live' : 'paper'} ${trading.liveArmed ? 'armed' : ''}`}
        >
          {trading.mode}
          {trading.mode === 'LIVE' && trading.liveArmed && ' (ARMED)'}
        </span>
      </div>

      {trading.killSwitchActive && (
        <div className="status-section">
          <span className="kill-switch-active">KILL SWITCH ACTIVE</span>
        </div>
      )}
    </div>
  );
}
