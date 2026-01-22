/**
 * Orders Panel - Active orders display
 *
 * Shows orders from Schwab account.
 * Fetches on mount, then updates via ORDER_* events.
 */

import { ComponentContainer } from 'golden-layout';
import { useState, useMemo, useEffect } from 'react';
import { useOrders, useAppStore, Order } from '../store/useAppStore';
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

// Map Schwab status to internal status
function mapSchwabStatus(status: string): Order['status'] {
  const statusMap: Record<string, Order['status']> = {
    'WORKING': 'confirmed',
    'PENDING_ACTIVATION': 'pending',
    'QUEUED': 'pending',
    'ACCEPTED': 'submitted',
    'AWAITING_PARENT_ORDER': 'pending',
    'AWAITING_CONDITION': 'pending',
    'AWAITING_MANUAL_REVIEW': 'pending',
    'PENDING_REPLACE': 'confirmed',
    'PENDING_CANCEL': 'confirmed',
    'FILLED': 'filled',
    'CANCELED': 'cancelled',
    'REJECTED': 'rejected',
    'EXPIRED': 'cancelled',
  };
  return statusMap[status] || 'pending';
}

export function OrdersPanel({ container: _container }: Props) {
  const orders = useOrders();
  const allOrders = Object.values(orders);
  const addPendingCommand = useAppStore((s) => s.addPendingCommand);
  const [activeTab, setActiveTab] = useState<FilterTab>('active');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load orders directly into store
  const loadOrders = useAppStore((s) => s.loadOrders);

  // Fetch orders on mount
  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const client = getAPIClient();
        const response = await client.getOrders();

        // Map API orders to store Order format
        const ordersMap: Record<string, Order> = {};
        for (const order of response.orders) {
          const storeOrder: Order = {
            client_order_id: order.order_id,
            symbol: order.symbol,
            side: order.side.toLowerCase() as 'buy' | 'sell',
            quantity: order.quantity,
            filled_quantity: order.filled_quantity,
            order_type: order.order_type,
            limit_price: order.limit_price ?? undefined,
            stop_price: order.stop_price ?? undefined,
            status: mapSchwabStatus(order.status),
            timestamp: order.entered_time,
          };
          ordersMap[order.order_id] = storeOrder;
        }

        // Load all orders at once
        loadOrders(ordersMap);
        console.log(`[ORDERS] Loaded ${response.orders.length} orders from Schwab`);
      } catch (err) {
        console.error('Failed to fetch orders:', err);
        setError('Trading data unavailable');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(
    () => filterOrders(allOrders, activeTab),
    [allOrders, activeTab]
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
  const activeCount = allOrders.filter((o) =>
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
            {isLoading ? (
              <tr>
                <td colSpan={8} className="empty-message">
                  Loading orders...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={8} className="empty-message">
                  {error}
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-message">
                  No {activeTab === 'all' ? '' : activeTab + ' '}orders
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr key={order.client_order_id || order.order_id}>
                  <td>{order.symbol || '-'}</td>
                  <td className={order.side?.toLowerCase() === 'buy' ? 'text-long' : 'text-short'}>
                    {order.side?.toUpperCase() || '-'}
                  </td>
                  <td>{order.quantity ?? '-'}</td>
                  <td>{order.filled_quantity ?? '-'}</td>
                  <td>{order.order_type || '-'}</td>
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
