/**
 * Chain Bar - Sterling-style symbol chain linking
 *
 * Shows 8 colored chain dots. Clicking a chain selects it.
 * Active chain symbol syncs across all chain-linked panels.
 * Includes panel menu for adding/restoring panels.
 */

import { useAppStore, CHAIN_COLORS, Timeframe, PANEL_DEFINITIONS, addPanel } from '../store/useAppStore';
import { useState, useRef, useEffect } from 'react';
import './ChainBar.css';

const TIMEFRAMES: Timeframe[] = ['10s', '1m', '5m', '1D'];

export function ChainBar() {
  const chains = useAppStore((s) => s.chains);
  const activeChainId = useAppStore((s) => s.activeChainId);
  const setActiveChain = useAppStore((s) => s.setActiveChain);
  const setChainSymbol = useAppStore((s) => s.setChainSymbol);
  const setChainTimeframe = useAppStore((s) => s.setChainTimeframe);

  const [editingSymbol, setEditingSymbol] = useState(false);
  const [panelMenuOpen, setPanelMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelMenuRef = useRef<HTMLDivElement>(null);

  // Close panel menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelMenuRef.current && !panelMenuRef.current.contains(e.target as Node)) {
        setPanelMenuOpen(false);
      }
    };
    if (panelMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [panelMenuOpen]);

  const handleAddPanel = (type: string, title: string) => {
    addPanel(type, title);
    setPanelMenuOpen(false);
  };

  const activeChain = chains[activeChainId];

  useEffect(() => {
    if (editingSymbol && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingSymbol]);

  const handleSymbolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditingSymbol(false);
  };

  const handleSymbolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChainSymbol(activeChainId, e.target.value);
  };

  const handleSymbolKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditingSymbol(false);
    }
  };

  return (
    <div className="chain-bar">
      <div className="chain-dots">
        {Object.values(chains).map((chain) => (
          <div
            key={chain.id}
            className={`chain-dot chain-${chain.id} ${chain.id === activeChainId ? 'active' : ''}`}
            style={{ backgroundColor: CHAIN_COLORS[chain.id] }}
            onClick={() => setActiveChain(chain.id)}
            title={`Chain ${chain.id}: ${chain.symbol || 'Empty'}`}
          >
            {chain.symbol ? chain.symbol.substring(0, 1) : ''}
          </div>
        ))}
      </div>

      <div className="chain-symbol-section">
        {editingSymbol ? (
          <form onSubmit={handleSymbolSubmit} className="symbol-form">
            <input
              ref={inputRef}
              type="text"
              className="symbol-input"
              value={activeChain.symbol}
              onChange={handleSymbolChange}
              onKeyDown={handleSymbolKeyDown}
              onBlur={() => setEditingSymbol(false)}
              placeholder="SYMBOL"
              maxLength={10}
            />
          </form>
        ) : (
          <div
            className="symbol-display"
            onClick={() => setEditingSymbol(true)}
            style={{ borderColor: activeChain.color }}
          >
            <span className="symbol-text">{activeChain.symbol || 'Click to set symbol'}</span>
          </div>
        )}
      </div>

      <div className="timeframe-selector">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            className={`timeframe-btn ${activeChain.timeframe === tf ? 'active' : ''}`}
            onClick={() => setChainTimeframe(activeChainId, tf)}
          >
            {tf}
          </button>
        ))}
      </div>

      <div className="chain-info">
        <span className="chain-label">Chain {activeChainId}</span>
      </div>

      <div className="panel-menu-container" ref={panelMenuRef}>
        <button
          className="panel-menu-btn"
          onClick={() => setPanelMenuOpen(!panelMenuOpen)}
          title="Add Panel"
        >
          + Panels
        </button>
        {panelMenuOpen && (
          <div className="panel-menu-dropdown">
            {PANEL_DEFINITIONS.map((panel) => (
              <button
                key={panel.type}
                className="panel-menu-item"
                onClick={() => handleAddPanel(panel.type, panel.title)}
              >
                {panel.title}
              </button>
            ))}
            <div className="panel-menu-divider" />
            <button
              className="panel-menu-item reset-item"
              onClick={() => {
                localStorage.removeItem('morpheus-layout');
                window.location.reload();
              }}
            >
              Reset Layout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
