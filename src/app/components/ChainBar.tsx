/**
 * Chain Bar - Sterling-style symbol chain linking
 *
 * Shows 8 colored chain dots. Clicking a chain selects it.
 * Active chain symbol syncs across all chain-linked panels.
 * Includes panel menu and layout management.
 */

import { useAppStore, CHAIN_COLORS, Timeframe, PANEL_DEFINITIONS, addPanel } from '../store/useAppStore';
import { useState, useRef, useEffect } from 'react';
import { useLayoutManager } from '../hooks/useLayoutManager';
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
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [saveAsPrompt, setSaveAsPrompt] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const saveAsInputRef = useRef<HTMLInputElement>(null);
  const panelMenuRef = useRef<HTMLDivElement>(null);
  const layoutMenuRef = useRef<HTMLDivElement>(null);

  const {
    layouts,
    isLoading,
    saveLayout,
    loadLayout,
    deleteLayout,
    resetToDefault,
  } = useLayoutManager();

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelMenuRef.current && !panelMenuRef.current.contains(e.target as Node)) {
        setPanelMenuOpen(false);
      }
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target as Node)) {
        setLayoutMenuOpen(false);
        setSaveAsPrompt(false);
      }
    };
    if (panelMenuOpen || layoutMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [panelMenuOpen, layoutMenuOpen]);

  // Focus save-as input when shown
  useEffect(() => {
    if (saveAsPrompt && saveAsInputRef.current) {
      saveAsInputRef.current.focus();
    }
  }, [saveAsPrompt]);

  const handleAddPanel = (type: string, title: string) => {
    addPanel(type, title);
    setPanelMenuOpen(false);
  };

  const handleSave = async () => {
    await saveLayout();
    setLayoutMenuOpen(false);
  };

  const handleSaveAs = async () => {
    if (saveAsName.trim()) {
      await saveLayout(saveAsName.trim());
      setSaveAsName('');
      setSaveAsPrompt(false);
      setLayoutMenuOpen(false);
    }
  };

  const handleLoadLayout = async (name: string) => {
    await loadLayout(name);
    setLayoutMenuOpen(false);
  };

  const handleDeleteLayout = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete layout "${name}"?`)) {
      await deleteLayout(name);
    }
  };

  const handleReset = () => {
    resetToDefault();
    setLayoutMenuOpen(false);
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

      {/* Layout Menu */}
      <div className="layout-menu-container" ref={layoutMenuRef}>
        <button
          className="layout-menu-btn"
          onClick={() => setLayoutMenuOpen(!layoutMenuOpen)}
          title="Layout Management"
          disabled={isLoading}
        >
          Layout
        </button>
        {layoutMenuOpen && (
          <div className="layout-menu-dropdown">
            <button className="layout-menu-item" onClick={handleSave}>
              Save
            </button>
            {saveAsPrompt ? (
              <div className="save-as-input-row">
                <input
                  ref={saveAsInputRef}
                  type="text"
                  className="save-as-input"
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveAs();
                    if (e.key === 'Escape') setSaveAsPrompt(false);
                  }}
                  placeholder="Layout name..."
                  maxLength={30}
                />
                <button className="save-as-confirm" onClick={handleSaveAs}>OK</button>
              </div>
            ) : (
              <button className="layout-menu-item" onClick={() => setSaveAsPrompt(true)}>
                Save As...
              </button>
            )}
            {layouts.length > 0 && (
              <>
                <div className="layout-menu-divider" />
                {layouts.map((name) => (
                  <div key={name} className="layout-menu-item layout-item-row">
                    <span
                      className="layout-name"
                      onClick={() => handleLoadLayout(name)}
                    >
                      {name}
                    </span>
                    <button
                      className="layout-delete-btn"
                      onClick={(e) => handleDeleteLayout(name, e)}
                      title="Delete layout"
                    >
                      X
                    </button>
                  </div>
                ))}
              </>
            )}
            <div className="layout-menu-divider" />
            <button className="layout-menu-item reset-item" onClick={handleReset}>
              Reset to Default
            </button>
          </div>
        )}
      </div>

      {/* Panel Menu */}
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
          </div>
        )}
      </div>
    </div>
  );
}
