/**
 * Morpheus UI - Main Application
 *
 * Sterling Trader Pro style docking workspace using GoldenLayout.
 * Connects to Morpheus_AI via WebSocket for events.
 */

import { useEffect, useRef, useCallback } from 'react';
import { GoldenLayout, LayoutConfig, ComponentContainer } from 'golden-layout';
import { useAppStore, setGoldenLayout } from './store/useAppStore';
import { createWSClient, MorpheusWSClient } from './morpheus/wsClient';
import { MorpheusEvent } from './morpheus/eventTypes';

// Panel imports
import {
  ChartPanel,
  WatchlistPanel,
  OrderEntryPanel,
  OrdersPanel,
  PositionsPanel,
  ExecutionsPanel,
  EventStreamPanel,
  MorpheusDecisionPanel,
  TradingControlsPanel,
  DecisionSupportPanel,
} from './panels';
import { ChainBar, StatusBar } from './components';
import { useGlobalHotkeys } from './hooks/useHotkeys';

// Panel component registry
const PANEL_COMPONENTS: Record<string, React.FC<{ container: ComponentContainer }>> = {
  chart: ChartPanel,
  watchlist: WatchlistPanel,
  orderEntry: OrderEntryPanel,
  orders: OrdersPanel,
  positions: PositionsPanel,
  executions: ExecutionsPanel,
  eventStream: EventStreamPanel,
  morpheusDecision: MorpheusDecisionPanel,
  tradingControls: TradingControlsPanel,
  decisionSupport: DecisionSupportPanel,
};

// Default layout configuration
// GoldenLayout v2 requires size as string percentages
const DEFAULT_LAYOUT: LayoutConfig = {
  root: {
    type: 'row',
    content: [
      {
        type: 'column',
        size: '20%',
        content: [
          {
            type: 'component',
            componentType: 'decisionSupport',
            title: 'Decision Support',
          },
          {
            type: 'component',
            componentType: 'watchlist',
            title: 'Watchlist',
          },
        ],
      },
      {
        type: 'column',
        size: '50%',
        content: [
          {
            type: 'component',
            componentType: 'chart',
            title: 'Chart',
          },
          {
            type: 'row',
            size: '30%',
            content: [
              {
                type: 'component',
                componentType: 'orders',
                title: 'Orders',
              },
              {
                type: 'component',
                componentType: 'positions',
                title: 'Positions',
              },
            ],
          },
        ],
      },
      {
        type: 'column',
        size: '30%',
        content: [
          {
            type: 'component',
            componentType: 'morpheusDecision',
            title: 'Morpheus Decision',
          },
          {
            type: 'component',
            componentType: 'eventStream',
            title: 'Event Stream',
          },
          {
            type: 'component',
            componentType: 'executions',
            title: 'Executions',
          },
        ],
      },
    ],
  },
};

export function App() {
  const layoutContainerRef = useRef<HTMLDivElement>(null);
  const goldenLayoutRef = useRef<GoldenLayout | null>(null);
  const wsClientRef = useRef<MorpheusWSClient | null>(null);

  // Initialize global hotkeys
  useGlobalHotkeys();

  const setConnectionStatus = useAppStore((s) => s.setConnectionStatus);
  const addEvent = useAppStore((s) => s.addEvent);
  const updateDecisionChain = useAppStore((s) => s.updateDecisionChain);
  const processOrderEvent = useAppStore((s) => s.processOrderEvent);
  const processExecutionEvent = useAppStore((s) => s.processExecutionEvent);
  const processPositionEvent = useAppStore((s) => s.processPositionEvent);
  const processSystemEvent = useAppStore((s) => s.processSystemEvent);

  // Handle incoming Morpheus events
  const handleEvent = useCallback(
    (event: MorpheusEvent) => {
      // Always add to event stream
      addEvent(event);

      // Route to appropriate processor based on event type
      const eventType = event.event_type;

      // Order events
      if (eventType.startsWith('ORDER_')) {
        processOrderEvent(event);
        processExecutionEvent(event); // ORDER_FILL_RECEIVED creates executions
      }

      // Position events
      if (eventType === 'POSITION_UPDATE') {
        processPositionEvent(event);
      }

      // System events
      if (eventType.startsWith('SYSTEM_') || eventType === 'HEARTBEAT') {
        processSystemEvent(event);
      }

      // Update decision chain based on event type
      if (event.symbol) {
        const symbol = event.symbol;
        switch (eventType) {
          case 'REGIME_DETECTED':
            updateDecisionChain(symbol, {
              regime: {
                regime: event.payload.regime as string,
                confidence: event.payload.confidence as number || 1.0,
                timestamp: event.timestamp,
              },
            });
            break;
          case 'SIGNAL_CANDIDATE':
            updateDecisionChain(symbol, {
              signal: {
                direction: event.payload.direction as 'long' | 'short' | 'none',
                strategy_name: event.payload.strategy_name as string,
                entry_price: event.payload.entry_price as number | undefined,
                stop_price: event.payload.stop_price as number | undefined,
                target_price: event.payload.target_price as number | undefined,
                timestamp: event.timestamp,
              },
            });
            break;
          case 'SIGNAL_SCORED':
            updateDecisionChain(symbol, {
              score: {
                confidence: event.payload.confidence as number,
                rationale: event.payload.rationale as string,
                model_name: event.payload.model_name as string,
                timestamp: event.timestamp,
              },
            });
            break;
          case 'META_APPROVED':
            updateDecisionChain(symbol, {
              gate: {
                decision: 'approved',
                reasons: [],
                timestamp: event.timestamp,
              },
            });
            break;
          case 'META_REJECTED':
            updateDecisionChain(symbol, {
              gate: {
                decision: 'rejected',
                reasons: event.payload.reasons as string[],
                timestamp: event.timestamp,
              },
            });
            break;
          case 'RISK_APPROVED':
            updateDecisionChain(symbol, {
              risk: {
                decision: 'approved',
                veto_reasons: [],
                position_size: event.payload.position_size as {
                  shares: number;
                  notional_value: string;
                },
                timestamp: event.timestamp,
              },
            });
            break;
          case 'RISK_VETO':
            updateDecisionChain(symbol, {
              risk: {
                decision: 'vetoed',
                veto_reasons: event.payload.veto_reasons as string[],
                timestamp: event.timestamp,
              },
            });
            break;
          case 'ORDER_SUBMITTED':
          case 'ORDER_CONFIRMED':
          case 'ORDER_FILL_RECEIVED':
            updateDecisionChain(symbol, {
              order: {
                status: eventType,
                client_order_id: event.payload.client_order_id as string,
                filled_quantity: (event.payload.filled_quantity as number) || 0,
                timestamp: event.timestamp,
              },
            });
            break;
        }
      }
    },
    [addEvent, updateDecisionChain, processOrderEvent, processExecutionEvent, processPositionEvent, processSystemEvent]
  );

  // Initialize WebSocket connection
  useEffect(() => {
    wsClientRef.current = createWSClient({
      url: 'ws://localhost:8010/ws/events',
      reconnectInterval: 1000,
      maxReconnectAttempts: 10,
      onEvent: handleEvent,
      onStateChange: setConnectionStatus,
    });

    wsClientRef.current.connect();

    return () => {
      wsClientRef.current?.disconnect();
    };
  }, [handleEvent, setConnectionStatus]);

  // Initialize GoldenLayout
  useEffect(() => {
    if (!layoutContainerRef.current) return;

    // Try to load saved layout from localStorage
    let layoutConfig = DEFAULT_LAYOUT;
    try {
      const savedLayout = localStorage.getItem('morpheus-layout');
      if (savedLayout) {
        const parsed = JSON.parse(savedLayout);
        // Validate that it has the required structure
        if (parsed && parsed.root) {
          layoutConfig = parsed;
        }
      }
    } catch (err) {
      console.warn('Failed to load saved layout, using default:', err);
    }

    const goldenLayout = new GoldenLayout(layoutContainerRef.current);

    // Register all panel components
    Object.entries(PANEL_COMPONENTS).forEach(([name, Component]) => {
      goldenLayout.registerComponentFactoryFunction(name, (container) => {
        // Create a wrapper div for React to render into
        const element = document.createElement('div');
        element.style.height = '100%';
        element.style.width = '100%';
        element.style.overflow = 'hidden';
        container.element.appendChild(element);

        // Import ReactDOM dynamically to avoid circular deps
        import('react-dom/client').then(({ createRoot }) => {
          const root = createRoot(element);
          root.render(<Component container={container} />);

          container.on('destroy', () => {
            setTimeout(() => root.unmount(), 0);
          });
        });
      });
    });

    // Load the layout
    goldenLayout.loadLayout(layoutConfig);

    // Save layout on changes (only after initialization)
    goldenLayout.on('stateChanged', () => {
      if (goldenLayout.isInitialised) {
        const config = goldenLayout.saveLayout();
        localStorage.setItem('morpheus-layout', JSON.stringify(config));
      }
    });

    goldenLayoutRef.current = goldenLayout;
    setGoldenLayout(goldenLayout);

    // Handle window resize
    const handleResize = () => {
      goldenLayout.setSize(
        layoutContainerRef.current!.offsetWidth,
        layoutContainerRef.current!.offsetHeight
      );
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      setGoldenLayout(null);
      goldenLayout.destroy();
    };
  }, []);

  return (
    <div className="app-container">
      <ChainBar />
      <div ref={layoutContainerRef} className="layout-container" />
      <StatusBar />
    </div>
  );
}

export default App;
