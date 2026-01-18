/**
 * Morpheus UI - Electron Main Process
 *
 * Sterling-style trading desktop shell.
 * Handles window management, IPC, and layout persistence.
 */

import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;

// Layout persistence paths
const userDataPath = app.getPath('userData');
const layoutsDir = path.join(userDataPath, 'layouts');
const defaultLayoutPath = path.join(layoutsDir, 'default.json');

// Ensure layouts directory exists
function ensureLayoutsDir(): void {
  if (!fs.existsSync(layoutsDir)) {
    fs.mkdirSync(layoutsDir, { recursive: true });
  }
}

function createWindow(): void {
  // Get primary display dimensions for optimal initial size
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1920, width),
    height: Math.min(1080, height),
    minWidth: 1024,
    minHeight: 768,
    title: 'Morpheus UI',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the app
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers for layout persistence
ipcMain.handle('layout:save', async (_event, layoutJson: string, name?: string) => {
  ensureLayoutsDir();
  const fileName = name ? `${name}.json` : 'default.json';
  const filePath = path.join(layoutsDir, fileName);

  try {
    fs.writeFileSync(filePath, layoutJson, 'utf-8');
    return { success: true, path: filePath };
  } catch (error) {
    console.error('Failed to save layout:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('layout:load', async (_event, name?: string) => {
  ensureLayoutsDir();
  const fileName = name ? `${name}.json` : 'default.json';
  const filePath = path.join(layoutsDir, fileName);

  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { success: true, layout: JSON.parse(content) };
    }
    return { success: false, error: 'Layout not found' };
  } catch (error) {
    console.error('Failed to load layout:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('layout:list', async () => {
  ensureLayoutsDir();

  try {
    const files = fs.readdirSync(layoutsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
    return { success: true, layouts: files };
  } catch (error) {
    console.error('Failed to list layouts:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('layout:delete', async (_event, name: string) => {
  const filePath = path.join(layoutsDir, `${name}.json`);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true };
    }
    return { success: false, error: 'Layout not found' };
  } catch (error) {
    console.error('Failed to delete layout:', error);
    return { success: false, error: String(error) };
  }
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
