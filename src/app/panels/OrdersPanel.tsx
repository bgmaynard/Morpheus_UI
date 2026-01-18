/**
 * Orders Panel - Active orders display
 *
 * Shows current open orders from event-derived state.
 * Cancel functionality sends commands - waits for events.
 */

import { ComponentContainer } from 'golden-layout';
import { useState, useMemo } from 'react';
import { useOpenOrders, useAppStore, Order } from '../store/useAppStore';
import { getAPIClient } from '../morpheus/apiClient';
import './panels.css';

interface Props {
  container: ComponentContainer;
}

// Status display mapping: internal -> user-friendly
const STATUS_DISPLAY: Record<string, string> = {
  pending: 'Working',
  submitted: 'Working',
  confirmed: 'Open',
  partial: 'Partial',
  filled: 'Filled',
  cancelled: 'Canceled',
  rejected: 'Rejected',
};

// Get display status from internal status
function getDisplayStatus(status: string): string {
  return STATUS_DISPLAY[status] || status;
}

// Get CSS class for status badge
function getStatusClass(status: string): string {
  switch (status) {
    case 'pending':
    case 'submitted':
      return 'working';
    case 'confirmed':
      return 'open';
    case 'partial':
      return 'partial';
    case 'filled':
      return 'filled';
    case 'cancelled':
    case 'rejected':
      return 'cancelled';
    default:
      return status;
  }
}

type FilterTab = 'active' | 'filled' | 'closed' | 'all';

// Filter orders by tab
function filterOrders(orders: Order[], tab: FilterTab): Order[] {
  switch (tab) {
    case 'active':
      return orders.filter((o) =>
        ['pending', 'submitted', 'confirmed', 'partial'].includes(o.status)
      );
    case 'filled':
      return orders.filter((o) => o.status === 'filled');
    case 'closed':
      return orders.filter((o) => ['cancelled', 'rejected'].includes(o.status));
    case 'all':
    default:
      return orders;
  }
}

export function OrdersPanel({ container: _container }: Props) {
  const openOrders = useOpenOrders();
  const addPendingCommand = useAppStore((s) => s.addPendingCommand);
  const [activeTab, setActiveTab] = useState<FilterTab>('active');

  const filteredOrders = useMemo(
    () => filterOrders(openOrders, activeTab),
    [openOrders, activeTab]
  );

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

  // Count orders per tab for badge display
  const activeCount = openOrders.filter((o) =>
    ['pending', 'submitted', 'confirmed', 'partial'].includes(o.status)
  ).length;

  return (
    <div className="morpheus-panel">
      <div className="morpheus-panel-header">
        <span className="panel-title">Orders</span>
        <button
          className="btn btn-small"
          onClick={handleCancelAll}
          disabled={activeCount === 0}
        >
          Cancel All
        </button>
      </div>
      <div className="orders-filter-tabs">
        <button
          className={`filter-tab ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active {activeCount > 0 && <span className="tab-count">{activeCount}</span>}
        </button>
        <button
          className={`filter-tab ${activeTab === 'filled' ? 'active' : ''}`}
          onClick={() => setActiveTab('filled')}
        >
          Filled
        </button>
        <button
          className={`filter-tab ${activeTab === 'closed' ? 'active' : ''}`}
          onClick={() => setActiveTab('closed')}
        >
          Closed
        </button>
        <button
          className={`filter-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All
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
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-message">
                  No {activeTab === 'all' ? '' : activeTab + ' '}orders
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
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
                    <span className={`status-badge ${getStatusClass(order.status)}`}>
                      {getDisplayStatus(order.status)}
                    </span>
                  </td>
                  <td>
                    {['pending', 'submitted', 'confirmed', 'partial'].includes(order.status) && (
                      <button
                        className="btn btn-tiny"
                        onClick={() => handleCancel(order.client_order_id)}
                      >
                        X
                      </button>
                    )}
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
