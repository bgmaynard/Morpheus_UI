/**
 * Executions Panel - Trade execution log
 *
 * Shows filled orders from event-derived state.
 * Populated by ORDER_FILL_RECEIVED events.
 */

import { ComponentContainer } from 'golden-layout';
import { useExecutions } from '../store/useAppStore';
import './panels.css';

interface Props {
  container: ComponentContainer;
}

export function ExecutionsPanel({ container }: Props) {
  const executions = useExecutions();

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString();
  };

  return (
    <div className="morpheus-panel">
      <div className="morpheus-panel-header">
        <span className="panel-title">Executions</span>
        <span className="text-muted">Today: {executions.length}</span>
      </div>
      <div className="morpheus-panel-content">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Symbol</th>
              <th>Side</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {executions.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-message">
                  No executions today
                </td>
              </tr>
            ) : (
              executions.map((exec) => (
                <tr key={exec.exec_id}>
                  <td className="text-muted">{formatTime(exec.timestamp)}</td>
                  <td>{exec.symbol}</td>
                  <td className={exec.side === 'buy' ? 'text-long' : 'text-short'}>
                    {exec.side.toUpperCase()}
                  </td>
                  <td className="text-right">{exec.quantity}</td>
                  <td className="text-right">{exec.price.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
