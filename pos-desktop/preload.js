const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printReceipt: (receiptHTML) => ipcRenderer.send('print-receipt', receiptHTML)
});
