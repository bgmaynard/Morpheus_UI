/**
 * Executions Panel - Trade execution log
 *
 * Shows filled orders from event-derived state.
 * Populated by ORDER_FILL_RECEIVED events from Schwab API.
 *
 * These are REAL executions from Schwab Paper Trading - not simulated.
 */

import { ComponentContainer } from 'golden-layout';
import { useExecutions, useOrders, useTrading } from '../store/useAppStore';
import './panels.css';

interface Props {
  container: ComponentContainer;
}

export function ExecutionsPanel({ container: _container }: Props) {
  const executions = useExecutions();
  const orders = useOrders();
  const trading = useTrading();

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString();
  };

  // Determine execution status based on linked order
  const getExecutionStatus = (clientOrderId: string): 'FILLED' | 'PARTIAL' => {
    const order = orders[clientOrderId];
    if (!order) return 'FILLED'; // If order not found, assume filled
    return order.status === 'partial' ? 'PARTIAL' : 'FILLED';
  };

  return (
    <div className="morpheus-panel">
      <div className="morpheus-panel-header">
        <span className="panel-title">Executions</span>
        <span className={`exec-source-badge ${trading.mode.toLowerCase()}`}>
          Schwab {trading.mode}
        </span>
        <span className="text-muted">Today: {executions.length}</span>
      </div>
      <div className="executions-info-banner">
        Real Schwab executions only - manual TOS trades not shown
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
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {executions.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-message">
                  No executions today
                </td>
              </tr>
            ) : (
              executions.map((exec) => {
                const status = getExecutionStatus(exec.client_order_id);
                return (
                  <tr key={exec.exec_id}>
                    <td className="text-muted">{formatTime(exec.timestamp)}</td>
                    <td>{exec.symbol}</td>
                    <td className={exec.side === 'buy' ? 'text-long' : 'text-short'}>
                      {exec.side.toUpperCase()}
                    </td>
                    <td className="text-right">{exec.quantity}</td>
                    <td className="text-right">${exec.price.toFixed(2)}</td>
                    <td>
                      <span className={`status-badge ${status.toLowerCase()}`}>
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
