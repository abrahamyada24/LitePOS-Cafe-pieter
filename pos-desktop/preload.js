const { contextBridge, ipcRenderer } = require('electron');

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const center = (value, width) => {
  const text = normalizeText(value).slice(0, width);
  return `${' '.repeat(Math.max(0, Math.floor((width - text.length) / 2)))}${text}`;
};

const columns = (leftValue, rightValue, width) => {
  const right = normalizeText(rightValue).slice(-width);
  const maxLeftLength = Math.max(0, width - right.length - 1);
  const left = normalizeText(leftValue).slice(0, maxLeftLength);
  return `${left}${' '.repeat(Math.max(1, width - left.length - right.length))}${right}`;
};

const wrapText = (value, width) => {
  const words = normalizeText(value).split(' ').filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    let remaining = word;
    while (remaining.length > width) {
      if (current) {
        lines.push(current);
        current = '';
      }
      lines.push(remaining.slice(0, width));
      remaining = remaining.slice(width);
    }
    if (!remaining) continue;

    if (!current) {
      current = remaining;
    } else if (`${current} ${remaining}`.length <= width) {
      current += ` ${remaining}`;
    } else {
      lines.push(current);
      current = remaining;
    }
  }
  if (current) lines.push(current);
  return lines;
};

const convertLegacyReceiptHtmlToText = (receiptHTML) => {
  const source = String(receiptHTML || '');
  const width = /(?:size|width)\s*:\s*80mm/i.test(source) ? 48 : 32;
  const divider = '-'.repeat(width);
  const documentNode = new DOMParser().parseFromString(source, 'text/html');
  const lines = [];

  const renderElement = (element, centerText = false) => {
    if (element.tagName === 'IMG' || element.classList.contains('receipt-logo')) return;

    if (
      element.classList.contains('border-t')
      && !element.classList.contains('receipt-value-row')
      && element.children.length === 0
      && !normalizeText(element.textContent)
    ) {
      lines.push(divider);
      return;
    }

    if (element.classList.contains('receipt-value-row')) {
      const cells = Array.from(element.children);
      if (cells.length >= 2) {
        lines.push(columns(cells[0].textContent, cells[cells.length - 1].textContent, width));
      } else {
        const value = normalizeText(element.textContent);
        if (value) lines.push(value.slice(0, width));
      }
      return;
    }

    const nextCenterText = centerText || element.classList.contains('text-center');
    if (element.children.length === 0) {
      const value = normalizeText(element.textContent);
      if (!value) return;
      for (const wrappedLine of wrapText(value, width)) {
        lines.push(nextCenterText ? center(wrappedLine, width) : wrappedLine);
      }
      return;
    }

    for (const child of element.children) renderElement(child, nextCenterText);
  };

  for (const child of documentNode.body.children) renderElement(child);
  lines.push('', '', '');
  return lines.join('\n');
};

contextBridge.exposeInMainWorld('electronAPI', {
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printReceiptRaw: (payload) => ipcRenderer.invoke('print-receipt-raw', payload),
  // Compatibility for the currently deployed web UI. Newer web builds call
  // printReceiptRaw directly with the shared Android-style formatter.
  printReceipt: (receiptHTML) => {
    try {
      const text = convertLegacyReceiptHtmlToText(receiptHTML);
      return ipcRenderer.invoke('print-receipt-raw', { text }).catch(() => {
        ipcRenderer.send('print-receipt', receiptHTML);
      });
    } catch (_) {
      ipcRenderer.send('print-receipt', receiptHTML);
      return Promise.resolve();
    }
  },
});
