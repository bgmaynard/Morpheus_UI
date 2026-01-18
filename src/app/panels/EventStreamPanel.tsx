/**
 * Event Stream Panel - Live Morpheus event feed
 *
 * Shows all events from Morpheus_AI WebSocket stream.
 * Color-coded by event category.
 */

import { ComponentContainer } from 'golden-layout';
import { useAppStore } from '../store/useAppStore';
import { EVENT_CATEGORIES, EVENT_COLORS, EventType } from '../morpheus/eventTypes';
import { useState, useRef, useEffect } from 'react';
import './panels.css';

interface Props {
  container: ComponentContainer;
}

const CATEGORY_OPTIONS = ['All', 'Signal', 'Gate', 'Risk', 'Order', 'Trade', 'System'];

export function EventStreamPanel({ container }: Props) {
  const events = useAppStore((s) => s.events);
  const clearEvents = useAppStore((s) => s.clearEvents);
  const [filter, setFilter] = useState('All');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events, autoScroll]);

  const filteredEvents = events.filter((event) => {
    if (filter === 'All') return true;
    const category = EVENT_CATEGORIES[event.event_type as EventType];
    return category === filter;
  });

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  return (
    <div className="morpheus-panel">
      <div className="morpheus-panel-header">
        <span className="panel-title">Event Stream</span>
        <div className="event-controls">
          <select
            className="input input-small"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <label className="autoscroll-label">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto
          </label>
          <button className="btn btn-small" onClick={clearEvents}>
            Clear
          </button>
        </div>
      </div>
      <div className="morpheus-panel-content event-stream" ref={scrollRef}>
        {filteredEvents.length === 0 ? (
          <div className="empty-message">
            {events.length === 0
              ? 'Waiting for events from Morpheus...'
              : 'No events match filter'}
          </div>
        ) : (
          filteredEvents.map((event) => {
            const category = EVENT_CATEGORIES[event.event_type as EventType] || 'System';
            const color = EVENT_COLORS[category] || '#95a5a6';

            return (
              <div key={event.event_id} className="event-row">
                <span className="event-time">{formatTime(event.timestamp)}</span>
                <span
                  className="event-badge"
                  style={{ backgroundColor: color }}
                >
                  {category}
                </span>
                <span className="event-type">{event.event_type}</span>
                {event.symbol && (
                  <span className="event-symbol">{event.symbol}</span>
                )}
                <span className="event-payload">
                  {JSON.stringify(event.payload).substring(0, 100)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
