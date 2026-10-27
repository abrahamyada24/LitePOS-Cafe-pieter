const test = require('node:test');
const assert = require('node:assert/strict');
const { parseReportQuery, pageMeta } = require('./reportPaginationService');
test('filter diterapkan sebelum pagination, tanggal menggunakan Jakarta', () => {
  const result = parseReportQuery({ page: '3', limit: '20', startDate: '2026-10-01', endDate: '2026-10-27' }, { role: 'CASHIER', id: 7 });
  assert.equal(result.skip, 40);
  assert.equal(result.where.userId, 7);
  assert.equal(result.where.openedAt.gte.toISOString(), '2026-09-30T17:00:00.000Z');
  assert.equal(result.where.openedAt.lt.toISOString(), '2026-10-27T17:00:00.000Z');
});
test('halaman terakhir tidak menghilangkan data, ukuran halaman dibatasi', () => {
  assert.deepEqual(pageMeta(3, 20, 45), { page: 3, limit: 20, total: 45, totalPages: 3 });
  assert.equal(parseReportQuery({ limit: 9999 }).limit, 100);
  assert.throws(() => parseReportQuery({ startDate: '2026-10-27', endDate: '2026-10-01' }), /tidak valid/);
});
