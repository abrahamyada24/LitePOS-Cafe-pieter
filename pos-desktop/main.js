const { app, BrowserWindow, ipcMain, nativeImage, net } = require('electron');
const path = require('path');
const { buildReceiptCommand, createLogoRasterCommand } = require('./escpos');
const { getWindowsPrinterDetails, sendRawCommand } = require('./windowsRawPrinter');

const APP_URL = process.env.LITEPOS_APP_URL || 'https://litepos-cafe-pieter.pages.dev/login/';
const APP_ICON = app.isPackaged
  ? path.join(process.resourcesPath, 'icon.png')
  : path.join(__dirname, '..', 'pos-fe', 'public', 'icon.png');
const MAX_RECEIPT_TEXT_LENGTH = 100_000;
const MAX_LOGO_BYTES = 4 * 1024 * 1024;

const getSenderUrl = (event) => event.senderFrame?.url || event.sender.getURL();

const assertTrustedRenderer = (event) => {
  const senderUrl = getSenderUrl(event);
  if (new URL(senderUrl).origin !== new URL(APP_URL).origin) {
    throw new Error('Permintaan printer ditolak karena sumber halaman tidak dikenal.');
  }
};

const getAvailablePrinters = async (webContents) => {
  const printers = await webContents.getPrintersAsync();
  const windowsDetails = await getWindowsPrinterDetails().catch((error) => {
    console.warn('Detail printer Windows tidak dapat dibaca:', error.message);
    return [];
  });
  const detailsByName = new Map(
    windowsDetails.map((printer) => [printer.name.toLocaleLowerCase(), printer]),
  );

  return printers.map((printer) => {
    const details = detailsByName.get(printer.name.toLocaleLowerCase());
    return {
      name: printer.name,
      displayName: printer.displayName || printer.name,
      description: printer.description || '',
      status: printer.status,
      isDefault: Boolean(printer.isDefault || details?.isDefault),
      driverName: details?.driverName || '',
      portName: details?.portName || '',
      workOffline: Boolean(details?.workOffline || (Number(printer.status || 0) & 0x80)),
      printerStatus: details?.printerStatus || 0,
    };
  });
};

const resolvePrinterName = async (webContents, requestedName) => {
  const printers = await getAvailablePrinters(webContents);
  if (printers.length === 0) throw new Error('Tidak ada printer Windows yang terpasang.');

  if (requestedName) {
    const selected = printers.find((printer) => printer.name === requestedName);
    if (!selected) throw new Error(`Printer "${requestedName}" tidak ditemukan.`);
    if (selected.workOffline) {
      throw new Error(`Printer "${requestedName}" sedang Offline. Pilih antrean printer yang Online.`);
    }
    return selected.name;
  }

  const availablePrinters = printers.filter((printer) => !printer.workOffline);
  if (availablePrinters.length === 0) {
    throw new Error('Semua printer Windows sedang Offline. Periksa kabel, daya, dan antrean printer.');
  }
  return availablePrinters.find((printer) => printer.isDefault)?.name || availablePrinters[0].name;
};

const loadLogoImage = async (logoUrl) => {
  if (!logoUrl) return null;
  if (typeof logoUrl !== 'string' || logoUrl.length > 8_000) throw new Error('Alamat logo tidak valid.');

  if (logoUrl.startsWith('data:image/')) {
    if (logoUrl.length > MAX_LOGO_BYTES * 1.5) throw new Error('Ukuran logo terlalu besar.');
    return nativeImage.createFromDataURL(logoUrl);
  }

  const parsedUrl = new URL(logoUrl);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Protokol logo tidak didukung.');

  const response = await net.fetch(parsedUrl.toString());
  if (!response.ok) throw new Error(`Logo tidak dapat diunduh (${response.status}).`);
  const declaredSize = Number(response.headers.get('content-length') || 0);
  if (declaredSize > MAX_LOGO_BYTES) throw new Error('Ukuran logo terlalu besar.');

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_LOGO_BYTES) throw new Error('Ukuran logo terlalu besar.');
  return nativeImage.createFromBuffer(buffer);
};

const createReceiptLogoCommand = async (logoUrl) => {
  const image = await loadLogoImage(logoUrl);
  if (!image || image.isEmpty()) throw new Error('Logo tidak dapat dibaca.');

  const size = image.getSize(1);
  const scale = Math.min(165 / size.width, 75 / size.height);
  const width = Math.max(1, Math.round(size.width * scale));
  const height = Math.max(1, Math.round(size.height * scale));
  const resized = image.resize({ width, height, quality: 'best' });
  return createLogoRasterCommand(resized.toBitmap({ scaleFactor: 1 }), width, height);
};

ipcMain.handle('get-printers', async (event) => {
  assertTrustedRenderer(event);
  return getAvailablePrinters(event.sender);
});

ipcMain.handle('print-receipt-raw', async (event, payload = {}) => {
  assertTrustedRenderer(event);

  const text = String(payload.text || '');
  if (!text.trim()) throw new Error('Isi struk masih kosong.');
  if (text.length > MAX_RECEIPT_TEXT_LENGTH) throw new Error('Isi struk terlalu panjang.');

  const printerName = await resolvePrinterName(event.sender, String(payload.printerName || ''));
  let logoRasterCommand = null;
  if (payload.logoUrl) {
    try {
      logoRasterCommand = await createReceiptLogoCommand(payload.logoUrl);
    } catch (error) {
      console.warn('Logo tidak dicetak, teks tetap dilanjutkan:', error.message);
    }
  }

  const command = buildReceiptCommand({ text, logoRasterCommand });
  const rawResult = await sendRawCommand(printerName, command);
  return { success: true, printerName, ...rawResult };
});

ipcMain.on('print-receipt', (event, receiptHTML) => {
  try {
    assertTrustedRenderer(event);
  } catch (error) {
    console.error(error.message);
    return;
  }
  if (typeof receiptHTML !== 'string' || receiptHTML.length > 2_000_000) {
    console.error('Dokumen cetak HTML tidak valid.');
    return;
  }

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
      color: false,
      margins: { marginType: 'none' },
      usePrinterDefaultPageSize: true,
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
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.maximize();
  win.setMenuBarVisibility(false);
  win.webContents.setZoomFactor(1);
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
