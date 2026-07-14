const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "LitePOS Desktop",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  win.maximize();
  win.setMenuBarVisibility(false); // Sembunyikan menu bar bawaan Windows

  // Memuat Vercel Frontend secara langsung (Cloud Desktop)
  win.loadURL('https://lite-pos-warnawarni.vercel.app');

  // Menangani proses Silent Print yang dikirim dari Vercel
  ipcMain.on('print-receipt', (event, receiptHTML) => {
    // Membuat jendela tersembunyi khusus untuk merender HTML Struk lalu mencetaknya
    let printWin = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
      }
    });

    // Masukkan desain struk (HTML) ke dalam jendela tersembunyi
    printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(receiptHTML)}`);

    printWin.webContents.on('did-finish-load', () => {
      // Perintahkan Windows untuk langsung mencetak tanpa kotak dialog (silent: true)
      printWin.webContents.print({
        silent: true,
        printBackground: true,
        margins: { marginType: 'printableArea' }
      }, (success, errorType) => {
        if (!success) {
            console.error('Gagal mencetak:', errorType);
        }
        printWin.close();
      });
    });
  });
}

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
