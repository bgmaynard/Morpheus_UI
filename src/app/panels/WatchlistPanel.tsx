/**
 * Watchlist Panel - Centralized symbol watchlist
 *
 * Uses the store's centralized watchlist and quotes.
 * All panels work from this single source of truth.
 */

import { ComponentContainer } from 'golden-layout';
import { useAppStore, useWatchlist, useWatchlistActions, useQuotes, CHAIN_COLORS } from '../store/useAppStore';
import { useState, useCallback, useEffect, KeyboardEvent } from 'react';
import { getAPIClient } from '../morpheus/apiClient';
import './panels.css';

interface Props {
  container: ComponentContainer;
}

export function WatchlistPanel({ container }: Props) {
  const chains = useAppStore((s) => s.chains);
  const setChainSymbol = useAppStore((s) => s.setChainSymbol);
  const setActiveChain = useAppStore((s) => s.setActiveChain);
  const activeChainId = useAppStore((s) => s.activeChainId);

  // Centralized watchlist from store
  const watchlist = useWatchlist();
  const { addToWatchlist, removeFromWatchlist } = useWatchlistActions();
  const quotes = useQuotes();

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [newSymbolInput, setNewSymbolInput] = useState('');
  const [marketDataAvailable, setMarketDataAvailable] = useState<boolean | null>(null);

  // Check market data status on mount
  useEffect(() => {
    const checkMarketData = async () => {
      try {
        const client = getAPIClient();
        const status = await client.getMarketStatus();
        setMarketDataAvailable(status.available);
      } catch {
        setMarketDataAvailable(false);
      }
    };
    checkMarketData();
  }, []);

  // Get connection status to resubscribe when reconnected
  const connectionStatus = useAppStore((s) => s.connection.websocket);

  // Subscribe to all watchlist symbols on load and when watchlist/connection changes
  useEffect(() => {
    // Only subscribe if we have a connection
    if (connectionStatus !== 'connected' && connectionStatus !== 'connecting') {
      return;
    }

    const client = getAPIClient();

    // Subscribe all watchlist symbols
    const subscribeAll = async () => {
      for (const symbol of watchlist) {
        try {
          await client.subscribeSymbol(symbol);
          console.log(`[WATCHLIST] Subscribed to ${symbol}`);
        } catch (err) {
          console.error(`Failed to subscribe to ${symbol}:`, err);
        }
      }
    };

    if (watchlist.length > 0) {
      console.log(`[WATCHLIST] Syncing ${watchlist.length} symbols with server...`);
      subscribeAll();
    }
  }, [watchlist, connectionStatus]);

  const handleSymbolClick = (symbol: string) => {
    setSelectedSymbol(symbol);
    // Update the active chain's symbol when clicking a row
    setChainSymbol(activeChainId, symbol);
  };

  const handleChainAssign = (chainId: number, symbol: string) => {
    setChainSymbol(chainId, symbol);
    setActiveChain(chainId);
  };

  const getChainForSymbol = (symbol: string): number | null => {
    for (const [id, chain] of Object.entries(chains)) {
      if (chain.symbol === symbol) {
        return parseInt(id);
      }
    }
    return null;
  };

  // Add new symbol to watchlist
  const handleAddSymbol = useCallback(async () => {
    const symbol = newSymbolInput.trim().toUpperCase();
    if (!symbol) return;

    // Check if already in watchlist
    if (watchlist.includes(symbol)) {
      setNewSymbolInput('');
      return;
    }

    // Add to centralized watchlist
    addToWatchlist(symbol);
    setNewSymbolInput('');

    // Also set it as the active chain's symbol
    setChainSymbol(activeChainId, symbol);

    // Subscribe to live data
    try {
      const client = getAPIClient();
      await client.subscribeSymbol(symbol);
      console.log(`[WATCHLIST] Subscribed to ${symbol}`);
    } catch (err) {
      console.error('Failed to subscribe:', err);
    }
  }, [newSymbolInput, watchlist, activeChainId, setChainSymbol, addToWatchlist]);

  // Handle Enter key in add symbol input
  const handleAddSymbolKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddSymbol();
    }
  }, [handleAddSymbol]);

  // Remove symbol from watchlist
  const handleRemoveSymbol = useCallback(async (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Remove from centralized watchlist
    removeFromWatchlist(symbol);

    // Clear selection if we removed the selected symbol
    if (selectedSymbol === symbol) {
      setSelectedSymbol(null);
    }

    // Unsubscribe from live data
    try {
      const client = getAPIClient();
      await client.unsubscribeSymbol(symbol);
      console.log(`[WATCHLIST] Unsubscribed from ${symbol}`);
    } catch (err) {
      console.error('Failed to unsubscribe:', err);
    }
  }, [selectedSymbol, removeFromWatchlist]);

  return (
    <div className="morpheus-panel watchlist-panel">
      <div className="morpheus-panel-header">
        <span className="panel-title">Watchlist</span>
        <div className="watchlist-controls">
          {marketDataAvailable === false && (
            <span className="market-status-badge offline">Offline</span>
          )}
          <span className="watchlist-count">{watchlist.length} symbols</span>
        </div>
      </div>
      <div className="morpheus-panel-content">
        {/* Add symbol input */}
        <div className="watchlist-add-row">
          <input
            type="text"
            className="symbol-input watchlist-add-input"
            value={newSymbolInput}
            onChange={(e) => setNewSymbolInput(e.target.value.toUpperCase())}
            onKeyDown={handleAddSymbolKeyDown}
            placeholder="Add symbol..."
            spellCheck={false}
          />
          <button className="btn btn-tiny btn-add" onClick={handleAddSymbol}>
            +
          </button>
        </div>

        <table className="data-table watchlist-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th className="text-right">Last</th>
              <th className="text-right">Bid</th>
              <th className="text-right">Ask</th>
              <th>Chain</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {watchlist.map((symbol) => {
              const quote = quotes[symbol];
              const chainId = getChainForSymbol(symbol);
              return (
                <tr
                  key={symbol}
                  className={selectedSymbol === symbol ? 'selected' : ''}
                  onClick={() => handleSymbolClick(symbol)}
                >
                  <td className="symbol-cell">{symbol}</td>
                  <td className="text-right">
                    {quote?.last ? `$${quote.last.toFixed(2)}` : '--'}
                  </td>
                  <td className="text-right">
                    {quote?.bid ? `$${quote.bid.toFixed(2)}` : '--'}
                  </td>
                  <td className="text-right">
                    {quote?.ask ? `$${quote.ask.toFixed(2)}` : '--'}
                  </td>
                  <td className="chain-cell">
                    {chainId ? (
                      <div
                        className="chain-dot-small"
                        style={{ backgroundColor: CHAIN_COLORS[chainId] }}
                      />
                    ) : (
                      <div className="chain-assign">
                        {[1, 2, 3, 4].map((id) => (
                          <div
                            key={id}
                            className="chain-dot-tiny"
                            style={{ backgroundColor: CHAIN_COLORS[id] }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleChainAssign(id, symbol);
                            }}
                            title={`Assign to Chain ${id}`}
                          />
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="remove-cell">
                    <button
                      className="btn-remove"
                      onClick={(e) => handleRemoveSymbol(symbol, e)}
                      title="Remove from watchlist"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {watchlist.length === 0 && (
          <div className="empty-message">No symbols in watchlist. Add symbols above.</div>
        )}
        {marketDataAvailable === false && watchlist.length > 0 && (
          <div className="market-data-warning">
            Market data not configured. Set up Schwab credentials.
          </div>
        )}
      </div>
    </div>
  );
}
