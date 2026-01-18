/**
 * Morpheus UI - Preload Script
 *
 * Secure IPC bridge between renderer and main process.
 * Exposes only necessary APIs via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Layout persistence API
const layoutApi = {
  save: (layoutJson: string, name?: string): Promise<{ success: boolean; path?: string; error?: string }> => {
    return ipcRenderer.invoke('layout:save', layoutJson, name);
  },

  load: (name?: string): Promise<{ success: boolean; layout?: unknown; error?: string }> => {
    return ipcRenderer.invoke('layout:load', name);
  },

  list: (): Promise<{ success: boolean; layouts?: string[]; error?: string }> => {
    return ipcRenderer.invoke('layout:list');
  },

  delete: (name: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('layout:delete', name);
  },
};

// Expose APIs to renderer
contextBridge.exposeInMainWorld('morpheusLayout', layoutApi);

// Type declarations for renderer
declare global {
  interface Window {
    morpheusLayout: typeof layoutApi;
  }
}
