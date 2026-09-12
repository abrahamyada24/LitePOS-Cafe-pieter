const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRawPrintScript, escapePowerShellLiteral } = require('./windowsRawPrinter');

test('escapes printer names for a PowerShell single-quoted literal', () => {
  assert.equal(escapePowerShellLiteral("Kasir O'Brien"), "Kasir O''Brien");
});

test('builds a RAW Winspool job using WritePrinter', () => {
  const script = buildRawPrintScript("POS O'Brien", "C:\\Temp\\receipt.bin");

  assert.match(script, /pDataType = 'RAW'/);
  assert.match(script, /WritePrinter/);
  assert.match(script, /StartPagePrinter/);
  assert.match(script, /POS O''Brien/);
  assert.match(script, /C:\\Temp\\receipt\.bin/);
});
