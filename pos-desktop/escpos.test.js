const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildReceiptCommand,
  createLogoRasterCommand,
  normalizePrinterText,
} = require('./escpos');

test('normalizes receipt text to printer-safe ASCII', () => {
  assert.equal(normalizePrinterText('Café — “Pieter”\r\n'), 'Cafe - "Pieter"\n');
});

test('builds an initialized left-aligned ESC/POS receipt command', () => {
  const result = buildReceiptCommand({ text: 'TOTAL   Rp 10.000\n' });
  assert.deepEqual([...result.subarray(0, 2)], [0x1b, 0x40]);
  assert.match(result.toString('ascii'), /TOTAL   Rp 10\.000/);
  assert.notEqual(result.indexOf(Buffer.from([0x1b, 0x4d, 0x00])), -1);
  assert.notEqual(result.indexOf(Buffer.from([0x1b, 0x20, 0x00])), -1);
  assert.notEqual(result.indexOf(Buffer.from([0x1d, 0x21, 0x00])), -1);
  assert.notEqual(result.indexOf(Buffer.from([0x1b, 0x61, 0x00])), -1);
});

test('packs black BGRA pixels into an ESC/POS raster row', () => {
  const pixels = Buffer.alloc(8 * 4, 0);
  for (let index = 0; index < 8; index += 1) pixels[(index * 4) + 3] = 255;
  const result = createLogoRasterCommand(pixels, 8, 1, {
    canvasWidth: 8,
    canvasHeight: 1,
    threshold: 180,
  });
  assert.deepEqual([...result.subarray(0, 8)], [0x1d, 0x76, 0x30, 0x00, 0x01, 0x00, 0x01, 0x00]);
  assert.equal(result[8], 0xff);
});
