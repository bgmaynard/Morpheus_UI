/**
 * Executions Panel - Trade execution log
 *
 * Shows transactions/executions from Schwab account.
 * Fetches on mount, then shows from event-derived state.
 */

import { ComponentContainer } from 'golden-layout';
import { useEffect, useState } from 'react';
import { useExecutions, useOrders, useTrading, useAppStore, Execution } from '../store/useAppStore';
import { getAPIClient } from '../morpheus/apiClient';
import './panels.css';

interface Props {
  container: ComponentContainer;
}

export function ExecutionsPanel({ container: _container }: Props) {
  const executions = useExecutions();
  const orders = useOrders();
  const trading = useTrading();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch transactions on mount
  useEffect(() => {
    const fetchTransactions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const client = getAPIClient();
        const response = await client.getTransactions();

        // Update store with fetched transactions
        const store = useAppStore.getState();
        const currentExecIds = new Set(store.executions.map(e => e.exec_id));

        for (const txn of response.transactions) {
          // Skip if already in store
          if (currentExecIds.has(txn.transaction_id)) continue;

          // Create execution from transaction
          const execution: Execution = {
            exec_id: txn.transaction_id,
            client_order_id: txn.order_id,
            symbol: txn.symbol,
            side: txn.side.toLowerCase() as 'buy' | 'sell',
            quantity: txn.quantity,
            price: txn.price,
            timestamp: txn.timestamp,
          };

          // Add to executions via processExecutionEvent
          store.processExecutionEvent({
            event_id: `init-${txn.transaction_id}`,
            event_type: 'ORDER_FILL_RECEIVED',
            timestamp: txn.timestamp,
            symbol: txn.symbol,
            payload: {
              exec_id: txn.transaction_id,
              client_order_id: txn.order_id,
              symbol: txn.symbol,
              side: txn.side.toLowerCase(),
              filled_quantity: txn.quantity,
              fill_price: txn.price,
            },
          });
        }
      } catch (err) {
        console.error('Failed to fetch transactions:', err);
        setError('Trading data unavailable');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, []);

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
        Schwab account executions
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
            {isLoading ? (
              <tr>
                <td colSpan={6} className="empty-message">
                  Loading executions...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="empty-message">
                  {error}
                </td>
              </tr>
            ) : executions.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-message">
                  No executions today
                </td>
              </tr>
            ) : (
              executions.map((exec) => {
                const status = getExecutionStatus(exec.client_order_id || exec.order_id);
                return (
                  <tr key={exec.exec_id || exec.transaction_id || Math.random()}>
                    <td className="text-muted">{formatTime(exec.timestamp)}</td>
                    <td>{exec.symbol || '-'}</td>
                    <td className={exec.side?.toLowerCase() === 'buy' ? 'text-long' : 'text-short'}>
                      {exec.side?.toUpperCase() || '-'}
                    </td>
                    <td className="text-right">{exec.quantity ?? '-'}</td>
                    <td className="text-right">${exec.price?.toFixed(2) || '0.00'}</td>
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
