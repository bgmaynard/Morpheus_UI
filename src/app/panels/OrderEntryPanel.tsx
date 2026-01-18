/**
 * Order Entry Panel - Manual order submission
 *
 * Allows submitting manual orders through Morpheus.
 * Orders still go through risk checks.
 *
 * Pattern:
 * 1. User clicks submit
 * 2. UI sends command with command_id
 * 3. UI shows "pending" state
 * 4. Morpheus emits ORDER_SUBMITTED or ORDER_REJECTED
 * 5. UI updates from event (not optimistically)
 */

import { ComponentContainer } from 'golden-layout';
import { useActiveChain, useAppStore, useHasPendingCommand, useTrading } from '../store/useAppStore';
import { useState, useEffect, useCallback, KeyboardEvent } from 'react';
import { getAPIClient, ManualOrderPayload } from '../morpheus/apiClient';
import './panels.css';

interface Props {
  container: ComponentContainer;
}

type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
type Side = 'buy' | 'sell';

export function OrderEntryPanel({ container }: Props) {
  const activeChain = useActiveChain();
  const activeChainId = useAppStore((s) => s.activeChainId);
  const setChainSymbol = useAppStore((s) => s.setChainSymbol);
  const trading = useTrading();
  const addPendingCommand = useAppStore((s) => s.addPendingCommand);
  const hasPendingOrder = useHasPendingCommand('SUBMIT_MANUAL_ORDER');

  // Symbol input state
  const [symbolInput, setSymbolInput] = useState(activeChain.symbol || '');

  // Sync input when chain changes externally
  useEffect(() => {
    setSymbolInput(activeChain.symbol || '');
  }, [activeChain.symbol]);

  // Handle Enter key to update chain symbol
  const handleSymbolKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form submission
      const newSymbol = symbolInput.trim().toUpperCase();
      if (newSymbol && newSymbol !== activeChain.symbol) {
        setChainSymbol(activeChainId, newSymbol);
      }
    }
  }, [symbolInput, activeChain.symbol, activeChainId, setChainSymbol]);

  const [side, setSide] = useState<Side>('buy');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [quantity, setQuantity] = useState('100');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'pending'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeChain.symbol) {
      setMessage({ type: 'error', text: 'No symbol selected' });
      return;
    }

    if (hasPendingOrder) {
      setMessage({ type: 'error', text: 'Order already pending' });
      return;
    }

    const order: ManualOrderPayload = {
      symbol: activeChain.symbol,
      side,
      quantity: parseInt(quantity),
      order_type: orderType,
    };

    if (orderType === 'limit' || orderType === 'stop_limit') {
      if (!limitPrice) {
        setMessage({ type: 'error', text: 'Limit price required' });
        return;
      }
      order.limit_price = parseFloat(limitPrice);
    }

    if (orderType === 'stop' || orderType === 'stop_limit') {
      if (!stopPrice) {
        setMessage({ type: 'error', text: 'Stop price required' });
        return;
      }
      order.stop_price = parseFloat(stopPrice);
    }

    setMessage({ type: 'pending', text: 'Submitting order...' });

    try {
      const client = getAPIClient();
      const result = await client.submitManualOrder(order);

      // Track pending command for UI feedback
      addPendingCommand({
        command_id: result.command_id,
        command_type: 'SUBMIT_MANUAL_ORDER',
        timestamp: Date.now(),
        symbol: activeChain.symbol,
      });

      if (result.accepted) {
        setMessage({ type: 'pending', text: 'Order sent - waiting for confirmation...' });
        // Don't show success until we get ORDER_SUBMITTED event
        // The store will remove the pending command when event arrives
      } else {
        setMessage({ type: 'error', text: result.message || 'Order not accepted' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to submit order' });
    }
  };

  // Clear message after events update state
  // In production, we'd watch for the specific command_id completion

  return (
    <div className="morpheus-panel">
      <div className="morpheus-panel-header">
        <span className="panel-title">
          <span className="chain-indicator" style={{ backgroundColor: activeChain.color }} />
          Order Entry
        </span>
        <span className={`mode-badge ${trading.mode.toLowerCase()}`}>{trading.mode}</span>
      </div>
      <div className="morpheus-panel-content">
        <form onSubmit={handleSubmit} className="order-form">
          <div className="order-symbol">
            <input
              type="text"
              className="order-symbol-input"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
              onKeyDown={handleSymbolKeyDown}
              placeholder="SYMBOL"
              spellCheck={false}
            />
          </div>

          <div className="side-buttons">
            <button
              type="button"
              className={`side-btn buy ${side === 'buy' ? 'active' : ''}`}
              onClick={() => setSide('buy')}
            >
              BUY
            </button>
            <button
              type="button"
              className={`side-btn sell ${side === 'sell' ? 'active' : ''}`}
              onClick={() => setSide('sell')}
            >
              SELL
            </button>
          </div>

          <div className="form-row">
            <label>Quantity</label>
            <input
              type="number"
              className="input"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
            />
          </div>

          <div className="form-row">
            <label>Order Type</label>
            <select
              className="input"
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as OrderType)}
            >
              <option value="market">Market</option>
              <option value="limit">Limit</option>
              <option value="stop">Stop</option>
              <option value="stop_limit">Stop Limit</option>
            </select>
          </div>

          {(orderType === 'limit' || orderType === 'stop_limit') && (
            <div className="form-row">
              <label>Limit Price</label>
              <input
                type="number"
                className="input"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                step="0.01"
              />
            </div>
          )}

          {(orderType === 'stop' || orderType === 'stop_limit') && (
            <div className="form-row">
              <label>Stop Price</label>
              <input
                type="number"
                className="input"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                step="0.01"
              />
            </div>
          )}

          <button
            type="submit"
            className={`submit-btn ${side}`}
            disabled={hasPendingOrder || !activeChain.symbol}
          >
            {hasPendingOrder
              ? 'Pending...'
              : `${side.toUpperCase()} ${activeChain.symbol || ''}`}
          </button>

          {message && (
            <div className={`order-message ${message.type}`}>{message.text}</div>
          )}
        </form>
      </div>
    </div>
  );
}
