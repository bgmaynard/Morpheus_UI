/**
 * Watchlist Panel - Symbol watchlist with chain dots
 *
 * Shows list of watched symbols with quick chain assignment.
 * Fetches REAL quote data from Morpheus API (Schwab).
 * Supports add/remove symbols dynamically.
 */

import { ComponentContainer } from 'golden-layout';
import { useAppStore, CHAIN_COLORS } from '../store/useAppStore';
import { useState, useCallback, useEffect, KeyboardEvent } from 'react';
import { getAPIClient, QuoteResponse } from '../morpheus/apiClient';
import './panels.css';

interface Props {
  container: ComponentContainer;
}

interface WatchlistItem {
  symbol: string;
  last: number;
  change: number;
  changePct: number;
  volume: number;
  isLoading: boolean;
}

// Initial watchlist symbols (no fake prices - will fetch from API)
const INITIAL_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'SPY'];

export function WatchlistPanel({ container }: Props) {
  const chains = useAppStore((s) => s.chains);
  const setChainSymbol = useAppStore((s) => s.setChainSymbol);
  const setActiveChain = useAppStore((s) => s.setActiveChain);
  const activeChainId = useAppStore((s) => s.activeChainId);

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() =>
    INITIAL_SYMBOLS.map((symbol) => ({
      symbol,
      last: 0,
      change: 0,
      changePct: 0,
      volume: 0,
      isLoading: true,
    }))
  );
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [newSymbolInput, setNewSymbolInput] = useState('');
  const [marketDataAvailable, setMarketDataAvailable] = useState<boolean | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch quotes for given symbols
  const fetchQuotesForSymbols = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) return;

    setIsRefreshing(true);

    try {
      const client = getAPIClient();
      const response = await client.getQuotes(symbols);

      setWatchlist((prev) =>
        prev.map((item) => {
          const quote = response.quotes[item.symbol];
          if (quote) {
            return {
              ...item,
              last: quote.last,
              volume: quote.volume,
              isLoading: false,
            };
          }
          return { ...item, isLoading: false };
        })
      );
    } catch (err) {
      console.error('Failed to fetch quotes:', err);
      setWatchlist((prev) =>
        prev.map((item) => ({ ...item, isLoading: false }))
      );
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Check market data status and fetch quotes on mount
  useEffect(() => {
    let mounted = true;

    const initializeData = async () => {
      try {
        const client = getAPIClient();
        const status = await client.getMarketStatus();

        if (!mounted) return;

        setMarketDataAvailable(status.available);

        // If market data is available, fetch quotes immediately
        if (status.available) {
          const symbols = INITIAL_SYMBOLS;
          fetchQuotesForSymbols(symbols);
        }
      } catch {
        if (mounted) {
          setMarketDataAvailable(false);
        }
      }
    };

    initializeData();

    return () => {
      mounted = false;
    };
  }, [fetchQuotesForSymbols]);

  // Fetch all current quotes (for refresh button)
  const fetchQuotes = useCallback(() => {
    const symbols = watchlist.map((item) => item.symbol);
    fetchQuotesForSymbols(symbols);
  }, [watchlist, fetchQuotesForSymbols]);

  const handleSymbolClick = (symbol: string) => {
    setSelectedSymbol(symbol);
    // Also update the active chain's symbol when clicking a row
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
    if (watchlist.some((item) => item.symbol === symbol)) {
      setNewSymbolInput('');
      return;
    }

    // Add new symbol with loading state
    const newItem: WatchlistItem = {
      symbol,
      last: 0,
      change: 0,
      changePct: 0,
      volume: 0,
      isLoading: true,
    };

    setWatchlist((prev) => [...prev, newItem]);
    setNewSymbolInput('');

    // Also set it as the active chain's symbol
    setChainSymbol(activeChainId, symbol);

    // Try to fetch the quote for the new symbol
    if (marketDataAvailable) {
      try {
        const client = getAPIClient();
        const quote = await client.getQuote(symbol);

        setWatchlist((prev) =>
          prev.map((item) =>
            item.symbol === symbol
              ? {
                  ...item,
                  last: quote.last,
                  volume: quote.volume,
                  isLoading: false,
                }
              : item
          )
        );
      } catch (err) {
        console.error(`Failed to fetch quote for ${symbol}:`, err);
        setWatchlist((prev) =>
          prev.map((item) =>
            item.symbol === symbol ? { ...item, isLoading: false } : item
          )
        );
      }
    } else {
      // Mark as not loading if market data unavailable
      setWatchlist((prev) =>
        prev.map((item) =>
          item.symbol === symbol ? { ...item, isLoading: false } : item
        )
      );
    }
  }, [newSymbolInput, watchlist, activeChainId, setChainSymbol, marketDataAvailable]);

  // Handle Enter key in add symbol input
  const handleAddSymbolKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddSymbol();
    }
  }, [handleAddSymbol]);

  // Remove symbol from watchlist
  const handleRemoveSymbol = useCallback((symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setWatchlist((prev) => prev.filter((item) => item.symbol !== symbol));

    // Clear selection if we removed the selected symbol
    if (selectedSymbol === symbol) {
      setSelectedSymbol(null);
    }
  }, [selectedSymbol]);

  // Refresh quotes from API
  const handleRefresh = useCallback(() => {
    if (marketDataAvailable) {
      fetchQuotes();
    }
  }, [marketDataAvailable, fetchQuotes]);

  return (
    <div className="morpheus-panel watchlist-panel">
      <div className="morpheus-panel-header">
        <span className="panel-title">Watchlist</span>
        <div className="watchlist-controls">
          {marketDataAvailable === false && (
            <span className="market-status-badge offline">Offline</span>
          )}
          <button
            className="btn btn-tiny"
            onClick={handleRefresh}
            disabled={isRefreshing || !marketDataAvailable}
            title="Refresh prices"
          >
            {isRefreshing ? '...' : 'Refresh'}
          </button>
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
              <th className="text-right">Change</th>
              <th>Chain</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {watchlist.map((item) => {
              const chainId = getChainForSymbol(item.symbol);
              return (
                <tr
                  key={item.symbol}
                  className={selectedSymbol === item.symbol ? 'selected' : ''}
                  onClick={() => handleSymbolClick(item.symbol)}
                >
                  <td className="symbol-cell">{item.symbol}</td>
                  <td className="text-right">
                    {item.isLoading ? (
                      <span className="loading-text">...</span>
                    ) : item.last > 0 ? (
                      item.last.toFixed(2)
                    ) : (
                      '--'
                    )}
                  </td>
                  <td
                    className={`text-right ${item.change >= 0 ? 'text-long' : 'text-short'}`}
                  >
                    {item.isLoading ? (
                      <span className="loading-text">...</span>
                    ) : item.last > 0 && item.change !== 0 ? (
                      <>
                        {item.change >= 0 ? '+' : ''}
                        {item.change.toFixed(2)} ({item.changePct.toFixed(2)}%)
                      </>
                    ) : (
                      '--'
                    )}
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
                              handleChainAssign(id, item.symbol);
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
                      onClick={(e) => handleRemoveSymbol(item.symbol, e)}
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
          <div className="empty-message">No symbols in watchlist</div>
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
