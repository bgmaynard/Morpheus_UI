/**
 * Positions Panel - Current positions display
 *
 * Shows open positions from event-derived state.
 * P&L calculated from position data.
 */

import { ComponentContainer } from 'golden-layout';
import { usePositions, useTotalPnL } from '../store/useAppStore';
import './panels.css';

interface Props {
  container: ComponentContainer;
}

export function PositionsPanel({ container }: Props) {
  const positions = usePositions();
  const totalPnL = useTotalPnL();
  const positionList = Object.values(positions);

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
            {positionList.length === 0 ? (
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
