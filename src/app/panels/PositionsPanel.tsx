/**
 * Positions Panel - Current positions display
 *
 * Shows open positions from Schwab account.
 * Fetches on mount, then updates via POSITION_UPDATE events.
 */

import { ComponentContainer } from 'golden-layout';
import { useEffect, useState } from 'react';
import { usePositions, useTotalPnL, useAppStore } from '../store/useAppStore';
import { getAPIClient } from '../morpheus/apiClient';
import './panels.css';

interface Props {
  container: ComponentContainer;
}

export function PositionsPanel({ container }: Props) {
  const positions = usePositions();
  const totalPnL = useTotalPnL();
  const positionList = Object.values(positions);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch positions on mount
  useEffect(() => {
    const fetchPositions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const client = getAPIClient();
        console.log('[POSITIONS] Fetching positions...');
        const response = await client.getPositions();
        console.log('[POSITIONS] API response:', response);

        // Update store with fetched positions
        const store = useAppStore.getState();
        for (const pos of response.positions) {
          console.log('[POSITIONS] Processing position:', pos);
          store.processPositionEvent({
            event_id: `init-${pos.symbol}`,
            event_type: 'POSITION_UPDATE',
            timestamp: new Date().toISOString(),
            symbol: pos.symbol,
            payload: pos,
          });
        }
        console.log('[POSITIONS] Store positions after update:', useAppStore.getState().positions);
      } catch (err) {
        console.error('[POSITIONS] Failed to fetch positions:', err);
        setError('Trading data unavailable');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPositions();
  }, []);

  return (
    <div className="morpheus-panel">
      <div className="morpheus-panel-header">
        <span className="panel-title">Positions</span>
        <span className={`pnl-total ${totalPnL >= 0 ? 'positive' : 'negative'}`}>
          P&L: {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
        </span>
      </div>
      <div className="morpheus-panel-content">
        <table className="data-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Avg</th>
              <th className="text-right">Last</th>
              <th className="text-right">P&L</th>
              <th className="text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="empty-message">
                  Loading positions...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="empty-message">
                  {error}
                </td>
              </tr>
            ) : positionList.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-message">
                  No open positions
                </td>
              </tr>
            ) : (
              positionList.map((pos) => (
                <tr key={pos.symbol}>
                  <td>{pos.symbol}</td>
                  <td
                    className={`text-right ${pos.quantity > 0 ? 'text-long' : 'text-short'}`}
                  >
                    {pos.quantity > 0 ? '+' : ''}
                    {pos.quantity}
                  </td>
                  <td className="text-right">{pos.avg_price.toFixed(2)}</td>
                  <td className="text-right">{pos.current_price.toFixed(2)}</td>
                  <td
                    className={`text-right ${pos.unrealized_pnl >= 0 ? 'text-long' : 'text-short'}`}
                  >
                    {pos.unrealized_pnl >= 0 ? '+' : ''}
                    {pos.unrealized_pnl.toFixed(2)}
                  </td>
                  <td
                    className={`text-right ${pos.unrealized_pnl_pct >= 0 ? 'text-long' : 'text-short'}`}
                  >
                    {pos.unrealized_pnl_pct >= 0 ? '+' : ''}
                    {pos.unrealized_pnl_pct.toFixed(2)}%
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
