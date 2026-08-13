const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeAddonIds,
  resolveSelectedAddons,
  buildAddonItemNotes,
} = require('./productAddonService');

test('normalizeAddonIds hanya menerima ID positif dan unik', () => {
  assert.deepEqual(normalizeAddonIds(['2', 2, 1, 0, 'abc', null]), [2, 1]);
});

test('resolveSelectedAddons menolak add-on milik produk lain', () => {
  assert.throws(
    () => resolveSelectedAddons([{ id: 1, name: 'Es', price: 1000 }], [2], 'Kopi'),
    /tidak valid/
  );
});

test('buildAddonItemNotes menyimpan pilihan dan catatan pelanggan', () => {
  const notes = buildAddonItemNotes(
    [{ id: 1, name: 'Extra Shot' }, { id: 2, name: 'Oat Milk' }],
    'tanpa gula'
  );
  assert.equal(notes, 'Add-on: Extra Shot, Oat Milk | tanpa gula');
});
