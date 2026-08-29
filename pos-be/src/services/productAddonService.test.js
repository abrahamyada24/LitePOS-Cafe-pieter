const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeAddonIds,
  normalizeAddonSelections,
  resolveSelectedAddons,
  buildAddonItemNotes,
  calculateAddonAwareLinePricing,
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

test('normalizeAddonSelections menerima payload lama dan menjumlahkan kuantitas payload baru', () => {
  assert.deepEqual(normalizeAddonSelections([1, '2']), [
    { id: 1, quantity: 1 },
    { id: 2, quantity: 1 },
  ]);
  assert.deepEqual(normalizeAddonSelections([
    { id: 1, quantity: 2 },
    { id: '1', qty: 3 },
  ]), [{ id: 1, quantity: 5 }]);
});

test('resolveSelectedAddons menyertakan kuantitas dan menolak jumlah di luar batas', () => {
  const selected = resolveSelectedAddons(
    [{ id: 1, name: 'Es', price: 1000 }],
    [{ id: 1, quantity: 3 }],
    'Kopi'
  );
  assert.equal(selected[0].quantity, 3);
  assert.throws(
    () => resolveSelectedAddons([{ id: 1, name: 'Es', price: 1000 }], [{ id: 1, quantity: 100 }], 'Kopi'),
    /1 sampai 99/
  );
});

test('buildAddonItemNotes menyimpan pilihan dan catatan pelanggan', () => {
  const notes = buildAddonItemNotes(
    [{ id: 1, name: 'Extra Shot', quantity: 2 }, { id: 2, name: 'Oat Milk', quantity: 1 }],
    'tanpa gula'
  );
  assert.equal(notes, 'Add-on: Extra Shot x2, Oat Milk | tanpa gula');
});

test('harga produk dan jumlah add-on dihitung terpisah', () => {
  const pricing = calculateAddonAwareLinePricing(
    { effectivePrice: 8500, originalPrice: 8500 },
    [{ price: 1000, quantity: 10 }],
    10
  );
  assert.equal(pricing.lineTotal, 95000);
  assert.equal(pricing.price, 9500);
});
