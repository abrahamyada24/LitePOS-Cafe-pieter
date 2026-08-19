const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const APP_URL = process.env.LITEPOS_APP_URL || 'https://lite-pos-cafe-pieter.vercel.app';

ipcMain.on('print-receipt', (_event, receiptHTML) => {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(receiptHTML)}`);
  printWindow.webContents.once('did-finish-load', () => {
    printWindow.webContents.print({
      silent: true,
      printBackground: true,
      margins: { marginType: 'printableArea' },
    }, (success, errorType) => {
      if (!success) console.error('Gagal mencetak:', errorType);
      if (!printWindow.isDestroyed()) printWindow.close();
    });
  });
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'LitePOS Cafe Pieter',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.maximize();
  win.setMenuBarVisibility(false);
  win.loadURL(APP_URL);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
