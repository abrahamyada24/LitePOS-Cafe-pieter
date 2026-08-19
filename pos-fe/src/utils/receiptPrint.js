const waitForPrintableAssets = async (doc) => {
  const images = Array.from(doc.images || []);
  const stylesheets = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
  await Promise.all([...images.map((image) => {
    if (image.complete) return Promise.resolve();

    return new Promise((resolve) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    });
  }), ...stylesheets.map((stylesheet) => {
    if (stylesheet.sheet) return Promise.resolve();

    return new Promise((resolve) => {
      stylesheet.addEventListener('load', resolve, { once: true });
      stylesheet.addEventListener('error', resolve, { once: true });
      window.setTimeout(resolve, 5_000);
    });
  })]);

  if (doc.fonts?.ready) await doc.fonts.ready;
};

const nextPaint = (targetWindow) => new Promise((resolve) => {
  targetWindow.requestAnimationFrame(() => targetWindow.requestAnimationFrame(resolve));
});

export const printReceiptElement = async (node, { paperWidthMm = 58, printMarginMm = 3 } = {}) => {
  if (typeof window === 'undefined' || !node) {
    throw new Error('Struk belum siap dicetak.');
  }

  const width = Number(paperWidthMm) === 80 ? 80 : 58;
  const margin = [0, 2, 3, 5].includes(Number(printMarginMm)) ? Number(printMarginMm) : 3;
  // Use standard printable area (48mm for 58mm paper, 72mm for 80mm paper)
  const printableWidth = width === 80 ? 72 : 48;
  const thermalMargin = width === 58 ? 0 : margin;
  const rightSafeMargin = width === 58 ? 0 : margin;
  
  // Make the fixed-width table span almost the entire printable width
  const valueRowWidth = width === 80 ? 68 : 46;
  const frame = document.createElement('iframe');
  frame.setAttribute('title', 'Dokumen cetak struk');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '1px',
    height: '1px',
    border: '0',
    opacity: '0',
    pointerEvents: 'none',
  });
  document.body.appendChild(frame);

  const cleanup = () => {
    if (frame.parentNode) frame.parentNode.removeChild(frame);
  };

  try {
    const printWindow = frame.contentWindow;
    const printDocument = frame.contentDocument;
    if (!printWindow || !printDocument) throw new Error('Browser tidak dapat menyiapkan dokumen cetak.');

    const receipt = node.cloneNode(true);
    receipt.setAttribute('data-receipt-print-root', 'true');
    const styles = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))
      .map((element) => element.outerHTML)
      .join('\n');

    printDocument.open();
    printDocument.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <base href="${document.baseURI}">
          ${styles}
          <style>
            @page { margin: 0; }
            html, body {
              width: ${printableWidth}mm !important;
              min-width: ${printableWidth}mm !important;
              margin: 0 !important;
              padding: 0 !important;
              text-align: left !important;
              overflow: visible !important;
              background: #fff !important;
              color: #000 !important;
              color-scheme: light !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body, body * { visibility: visible !important; }
            [data-receipt-print-root="true"] {
              display: block !important;
              position: static !important;
              inset: auto !important;
              width: ${printableWidth}mm !important;
              max-width: ${printableWidth}mm !important;
              height: auto !important;
              min-height: 0 !important;
              margin: 0 auto 0 0 !important;
              padding: ${thermalMargin}mm ${rightSafeMargin}mm ${thermalMargin}mm ${thermalMargin}mm !important;
              overflow: visible !important;
              box-sizing: border-box !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              background: #fff !important;
              color: #000 !important;
              font-family: "Courier New", Consolas, monospace !important;
              font-size: 9.5px !important;
              font-weight: 600 !important;
              line-height: 1.2 !important;
              letter-spacing: 0 !important;
              filter: none !important;
              transform: none !important;
              opacity: 1 !important;
              -webkit-font-smoothing: none !important;
              text-rendering: optimizeSpeed !important;
            }
            [data-receipt-print-root="true"] * {
              font-family: inherit !important;
              border-color: #000 !important;
              text-shadow: none !important;
              filter: none !important;
              opacity: 1 !important;
              -webkit-font-smoothing: none !important;
              text-rendering: optimizeSpeed !important;
            }
            [data-receipt-print-root="true"] .font-bold,
            [data-receipt-print-root="true"] .font-black {
              font-weight: 800 !important;
            }
            [data-receipt-print-root="true"] .border-t {
              border-top-width: 1px !important;
              border-top-style: solid !important;
            }
            [data-receipt-print-root="true"] .border-t.border-dashed {
              border-top-style: dashed !important;
            }
            [data-receipt-print-root="true"] [class~="text-center"] {
              text-align: center !important;
            }
            [data-receipt-print-root="true"] [class~="italic"] {
              font-style: italic !important;
            }
            [data-receipt-print-root="true"] [class~="line-through"] {
              text-decoration: line-through !important;
            }
            [data-receipt-print-root="true"] [class~="whitespace-pre-wrap"] {
              white-space: pre-wrap !important;
            }
            [data-receipt-print-root="true"] [class~="mb-3"] {
              margin-bottom: 3mm !important;
            }
            [data-receipt-print-root="true"] [class~="mt-1"] {
              margin-top: 1mm !important;
            }
            [data-receipt-print-root="true"] [class~="mt-2"] {
              margin-top: 2mm !important;
            }
            [data-receipt-print-root="true"] [class~="my-2"] {
              margin-top: 2mm !important;
              margin-bottom: 2mm !important;
            }
            [data-receipt-print-root="true"] [class~="pt-1"] {
              padding-top: 1mm !important;
            }
            [data-receipt-print-root="true"] [class~="space-y-0.5"] > * + * {
              margin-top: 0.5mm !important;
            }
            [data-receipt-print-root="true"] [class~="space-y-2"] > * + * {
              margin-top: 2mm !important;
            }
            [data-receipt-print-root="true"] .receipt-store-name {
              font-size: 14px !important;
            }
            [data-receipt-print-root="true"] .flex.font-black {
              font-size: 12px !important;
            }
            [data-receipt-print-root="true"] .receipt-value-row {
              display: table !important;
              table-layout: fixed !important;
              width: ${valueRowWidth}mm !important;
              table-layout: fixed !important;
              border-collapse: collapse !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            [data-receipt-print-root="true"] .receipt-value-row > span {
              display: table-cell !important;
              vertical-align: top !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            [data-receipt-print-root="true"] .receipt-value-row > span:first-child {
              width: 65% !important;
              text-align: left !important;
            }
            [data-receipt-print-root="true"] .receipt-value-row > span:last-child {
              width: 35% !important;
              text-align: right !important;
            }
            [data-receipt-print-root="true"] .receipt-logo {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
          </style>
        </head>
        <body>${receipt.outerHTML}</body>
      </html>`);
    printDocument.close();

    await waitForPrintableAssets(printDocument);
    await nextPaint(printWindow);

    let cleaned = false;
    const cleanupOnce = () => {
      if (cleaned) return;
      cleaned = true;
      cleanup();
    };
    printWindow.addEventListener('afterprint', cleanupOnce, { once: true });
    window.setTimeout(cleanupOnce, 60_000);
    printWindow.focus();
    printWindow.print();
  } catch (error) {
    cleanup();
    throw error;
  }
};
