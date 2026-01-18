/**
 * Orders Panel - Active orders display
 *
 * Shows current open orders from event-derived state.
 * Cancel functionality sends commands - waits for events.
 */

import { ComponentContainer } from 'golden-layout';
import { useOpenOrders, useAppStore } from '../store/useAppStore';
import { getAPIClient } from '../morpheus/apiClient';
import './panels.css';

interface Props {
  container: ComponentContainer;
}

export function OrdersPanel({ container }: Props) {
  const openOrders = useOpenOrders();
  const addPendingCommand = useAppStore((s) => s.addPendingCommand);

  const handleCancel = async (clientOrderId: string) => {
    try {
      const client = getAPIClient();
      const result = await client.cancelOrder(clientOrderId);

      addPendingCommand({
        command_id: result.command_id,
        command_type: 'CANCEL_ORDER',
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('Failed to cancel order:', err);
    }
  };

  const handleCancelAll = async () => {
    try {
      const client = getAPIClient();
      const result = await client.cancelAllOrders();

      addPendingCommand({
        command_id: result.command_id,
        command_type: 'CANCEL_ALL',
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('Failed to cancel all orders:', err);
    }
  };

  return (
    <div className="morpheus-panel">
      <div className="morpheus-panel-header">
        <span className="panel-title">Open Orders</span>
        <button
          className="btn btn-small"
          onClick={handleCancelAll}
          disabled={openOrders.length === 0}
        >
          Cancel All
        </button>
      </div>
      <div className="morpheus-panel-content">
        <table className="data-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Side</th>
              <th>Qty</th>
              <th>Filled</th>
              <th>Type</th>
              <th>Price</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {openOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-message">
                  No open orders
                </td>
              </tr>
            ) : (
              openOrders.map((order) => (
                <tr key={order.client_order_id}>
                  <td>{order.symbol}</td>
                  <td className={order.side === 'buy' ? 'text-long' : 'text-short'}>
                    {order.side.toUpperCase()}
                  </td>
                  <td>{order.quantity}</td>
                  <td>{order.filled_quantity}</td>
                  <td>{order.order_type}</td>
                  <td>{order.limit_price?.toFixed(2) || '-'}</td>
                  <td>
                    <span className={`status-badge ${order.status}`}>{order.status}</span>
                  </td>
                  <td>
                    <button
                      className="btn btn-tiny"
                      onClick={() => handleCancel(order.client_order_id)}
                    >
                      X
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
