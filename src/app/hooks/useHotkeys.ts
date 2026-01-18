/**
 * Hotkey Management Hook
 *
 * Global hotkey bindings for trading actions.
 * Uses Mousetrap for cross-browser keyboard handling.
 */

import { useEffect, useCallback } from 'react';
import Mousetrap from 'mousetrap';
import { useAppStore, useActiveChain, useDecisionChain, useTrading } from '../store/useAppStore';
import { getAPIClient, ConfirmEntryPayload } from '../morpheus/apiClient';

// Default hotkey bindings (can be made configurable later)
const DEFAULT_HOTKEYS = {
  confirmEntry: 'ctrl+enter',
  cancelAll: 'ctrl+shift+x',
  killSwitch: 'ctrl+shift+k',
};

// Signal status thresholds - SMALL-CAP MOMENTUM OPTIMIZED
// Must match Morpheus_AI ConfirmationGuardConfig
const CONFIRM_TTL_MS = 1200; // 1.2 seconds (small-cap optimized)

export function useGlobalHotkeys() {
  const activeChain = useActiveChain();
  const decisionChain = useDecisionChain(activeChain.symbol);
  const trading = useTrading();
  const addPendingCommand = useAppStore((s) => s.addPendingCommand);

  // Confirm Entry handler
  const handleConfirmEntry = useCallback(async () => {
    // Validate we can confirm
    if (!activeChain.symbol) {
      console.log('[Hotkey] CONFIRM_ENTRY blocked: No symbol selected');
      return;
    }

    if (!decisionChain?.signal) {
      console.log('[Hotkey] CONFIRM_ENTRY blocked: No active signal');
      return;
    }

    // Check signal age
    const signalTime = new Date(decisionChain.signal.timestamp).getTime();
    const age = Date.now() - signalTime;
    if (age >= CONFIRM_TTL_MS) {
      console.log(`[Hotkey] CONFIRM_ENTRY blocked: Signal stale (${(age / 1000).toFixed(1)}s > ${CONFIRM_TTL_MS / 1000}s TTL)`);
      return;
    }

    // Check gate
    if (decisionChain.gate?.decision === 'rejected') {
      console.log('[Hotkey] CONFIRM_ENTRY blocked: Gate rejected');
      return;
    }

    // Check risk
    if (decisionChain.risk?.decision === 'vetoed') {
      console.log('[Hotkey] CONFIRM_ENTRY blocked: Risk vetoed');
      return;
    }

    // Check guard
    if (decisionChain.guard?.decision === 'block') {
      console.log('[Hotkey] CONFIRM_ENTRY blocked: Guard blocked');
      return;
    }

    // Check live armed
    if (trading.mode === 'LIVE' && !trading.liveArmed) {
      console.log('[Hotkey] CONFIRM_ENTRY blocked: Live trading not armed');
      return;
    }

    // Check kill switch
    if (trading.killSwitchActive) {
      console.log('[Hotkey] CONFIRM_ENTRY blocked: Kill switch active');
      return;
    }

    // All checks passed - send confirmation
    console.log(`[Hotkey] CONFIRM_ENTRY: ${activeChain.symbol}`);

    try {
      const payload: ConfirmEntryPayload = {
        symbol: activeChain.symbol,
        chain_id: activeChain.id,
        signal_timestamp: decisionChain.signal.timestamp,
        entry_price: decisionChain.signal.entry_price || 0,
      };

      const client = getAPIClient();
      const result = await client.confirmEntry(payload);

      addPendingCommand({
        command_id: result.command_id,
        command_type: 'CONFIRM_ENTRY',
        timestamp: Date.now(),
        symbol: activeChain.symbol,
      });

      console.log(`[Hotkey] CONFIRM_ENTRY sent: ${result.command_id}`);
    } catch (error) {
      console.error('[Hotkey] CONFIRM_ENTRY failed:', error);
    }
  }, [activeChain, decisionChain, trading, addPendingCommand]);

  // Cancel All handler
  const handleCancelAll = useCallback(async () => {
    console.log('[Hotkey] CANCEL_ALL');
    try {
      const client = getAPIClient();
      await client.cancelAllOrders();
    } catch (error) {
      console.error('[Hotkey] CANCEL_ALL failed:', error);
    }
  }, []);

  // Kill Switch handler
  const handleKillSwitch = useCallback(async () => {
    console.log('[Hotkey] KILL_SWITCH');
    try {
      const client = getAPIClient();
      if (trading.killSwitchActive) {
        await client.deactivateKillSwitch();
      } else {
        await client.activateKillSwitch();
      }
    } catch (error) {
      console.error('[Hotkey] KILL_SWITCH failed:', error);
    }
  }, [trading.killSwitchActive]);

  // Register hotkeys
  useEffect(() => {
    // Confirm Entry: Ctrl+Enter
    Mousetrap.bind(DEFAULT_HOTKEYS.confirmEntry, (e) => {
      e.preventDefault();
      handleConfirmEntry();
      return false;
    });

    // Cancel All: Ctrl+Shift+X
    Mousetrap.bind(DEFAULT_HOTKEYS.cancelAll, (e) => {
      e.preventDefault();
      handleCancelAll();
      return false;
    });

    // Kill Switch: Ctrl+Shift+K
    Mousetrap.bind(DEFAULT_HOTKEYS.killSwitch, (e) => {
      e.preventDefault();
      handleKillSwitch();
      return false;
    });

    return () => {
      Mousetrap.unbind(DEFAULT_HOTKEYS.confirmEntry);
      Mousetrap.unbind(DEFAULT_HOTKEYS.cancelAll);
      Mousetrap.unbind(DEFAULT_HOTKEYS.killSwitch);
    };
  }, [handleConfirmEntry, handleCancelAll, handleKillSwitch]);
}

// Export hotkey config for display
export const HOTKEY_CONFIG = DEFAULT_HOTKEYS;
