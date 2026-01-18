/**
 * useLayoutManager - Layout operations hook
 *
 * Wraps window.morpheusLayout IPC bridge for layout persistence.
 */

import { useState, useEffect, useCallback } from 'react';
import { getGoldenLayout } from '../store/useAppStore';

// Type for the layout API exposed by preload
interface LayoutApi {
  save: (layoutJson: string, name?: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  load: (name?: string) => Promise<{ success: boolean; layout?: unknown; error?: string }>;
  list: () => Promise<{ success: boolean; layouts?: string[]; error?: string }>;
  delete: (name: string) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    morpheusLayout?: LayoutApi;
  }
}

export interface UseLayoutManagerResult {
  layouts: string[];
  currentLayout: string | null;
  isLoading: boolean;
  error: string | null;
  saveLayout: (name?: string) => Promise<boolean>;
  loadLayout: (name: string) => Promise<boolean>;
  deleteLayout: (name: string) => Promise<boolean>;
  resetToDefault: () => void;
  refreshLayouts: () => Promise<void>;
}

export function useLayoutManager(): UseLayoutManagerResult {
  const [layouts, setLayouts] = useState<string[]>([]);
  const [currentLayout, setCurrentLayout] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh list of saved layouts
  const refreshLayouts = useCallback(async () => {
    if (!window.morpheusLayout) return;
    try {
      const result = await window.morpheusLayout.list();
      if (result.success && result.layouts) {
        setLayouts(result.layouts);
      }
    } catch (err) {
      console.error('Failed to list layouts:', err);
    }
  }, []);

  // Load layouts on mount
  useEffect(() => {
    refreshLayouts();
  }, [refreshLayouts]);

  // Save current layout
  const saveLayout = useCallback(async (name?: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const goldenLayout = getGoldenLayout();
      if (!goldenLayout) {
        setError('Layout not initialized');
        return false;
      }

      const config = goldenLayout.saveLayout();
      const layoutJson = JSON.stringify(config);

      // Also save to localStorage for persistence
      localStorage.setItem('morpheus-layout', layoutJson);

      if (!window.morpheusLayout) {
        // No Electron IPC available, just use localStorage
        if (name) setCurrentLayout(name);
        return true;
      }

      const result = await window.morpheusLayout.save(layoutJson, name);

      if (result.success) {
        if (name) {
          setCurrentLayout(name);
        }
        await refreshLayouts();
        return true;
      } else {
        setError(result.error || 'Failed to save layout');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save layout');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshLayouts]);

  // Load a named layout
  const loadLayout = useCallback(async (name: string): Promise<boolean> => {
    if (!window.morpheusLayout) {
      setError('Layout API not available');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.morpheusLayout.load(name);

      if (result.success && result.layout) {
        // Store in localStorage and reload
        localStorage.setItem('morpheus-layout', JSON.stringify(result.layout));
        setCurrentLayout(name);
        window.location.reload();
        return true;
      } else {
        setError(result.error || 'Failed to load layout');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load layout');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Delete a named layout
  const deleteLayout = useCallback(async (name: string): Promise<boolean> => {
    if (!window.morpheusLayout) {
      setError('Layout API not available');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.morpheusLayout.delete(name);

      if (result.success) {
        await refreshLayouts();
        if (currentLayout === name) {
          setCurrentLayout(null);
        }
        return true;
      } else {
        setError(result.error || 'Failed to delete layout');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete layout');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentLayout, refreshLayouts]);

  // Reset to default layout
  const resetToDefault = useCallback(() => {
    localStorage.removeItem('morpheus-layout');
    setCurrentLayout(null);
    window.location.reload();
  }, []);

  return {
    layouts,
    currentLayout,
    isLoading,
    error,
    saveLayout,
    loadLayout,
    deleteLayout,
    resetToDefault,
    refreshLayouts,
  };
}
