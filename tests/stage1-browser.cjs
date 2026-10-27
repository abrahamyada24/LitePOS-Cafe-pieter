// Local, in-memory API fixtures only. This script never contacts the store API.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve('pos-fe/out');
const artifacts = path.resolve('artifacts/stage1');
fs.mkdirSync(artifacts, { recursive: true });
const user = { id: 1, name: 'Kasir Uji', role: 'OWNER', email: 'fixture@example.test' };
const settings = { storeName: 'F&B Uji Lokal', enableShift: true, enableDineTable: true, enableKitchenQueue: true, enableTableOrder: true, enableCash: true, taxRate: 0 };
const transaction = i => ({ id: i, invoiceNumber: `INV/20261027/K01/${String(i).padStart(4, '0')}`, createdAt: '2026-10-27T05:00:00Z', status: 'PAID', orderType: 'DINE_IN', grandTotal: 23000, subTotal: 23000, discountAmount: 0, taxAmount: 0, user, customer: { id: 1, name: 'Pelanggan Uji', phone: '081234567890' }, payments: [{ paymentType: 'CASH', amount: 23000, paymentStatus: 'SETTLEMENT' }], items: [{ id: 1, productId: 1, product: { name: 'Nasi Uji' }, qty: 1, price: 23000, costPrice: 10000 }] });
const calls = [];
const checkouts = [];
const fixture = url => {
  const pathname = url.pathname.replace(/\/$/, '');
  if (pathname.endsWith('/auth/me')) return { success: true, user };
  if (pathname.endsWith('/license/status')) return { success: true, data: { isActive: true, plan: 'PREMIUM' } };
  if (pathname.endsWith('/settings')) return { success: true, data: settings };
  if (pathname.endsWith('/customers')) return { success: true, data: [{ id: 1, name: 'Pelanggan Uji', phone: '081234567890' }] };
  if (pathname.endsWith('/reports/dashboard')) return { success: true, data: { summary: { totalTransactions: 145 }, chartData: [] } };
  if (/\/transactions\/\d+$/.test(pathname)) return { success: true, data: transaction(Number(pathname.split('/').pop())) };
  if (pathname.endsWith('/shifts/current')) return { success: true, data: null };
  if (pathname.endsWith('/shifts') || pathname.endsWith('/reports/shift') || pathname.endsWith('/transactions')) {
    const page = Number(url.searchParams.get('page') || 1); const limit = Number(url.searchParams.get('limit') || 20);
    const shifts = !pathname.endsWith('/transactions'); const total = shifts ? 45 : 145;
    const data = Array.from({ length: Math.max(0, Math.min(limit, total - (page - 1) * limit)) }, (_, index) => {
      const i = (page - 1) * limit + index + 1;
      return shifts ? { id: `shift-${i}`, userName: `Kasir ${i}`, userId: 1, openedAt: '2026-10-27T01:00:00Z', closedAt: '2026-10-27T09:00:00Z', status: 'CLOSED', totalSales: 23000, cashSales: 23000, transactionCount: 1 } : transaction(i);
    });
    return { success: true, data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  return { success: true, data: [] };
};
const server = http.createServer((req, res) => {
  let filename = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!filename.startsWith(root + path.sep) && filename !== root) { res.writeHead(403).end(); return; }
  if (fs.existsSync(filename) && fs.statSync(filename).isDirectory()) filename = path.join(filename, 'index.html');
  if (!fs.existsSync(filename)) { res.writeHead(404).end(); return; }
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
  res.setHeader('content-type', types[path.extname(filename)] || 'text/plain');
  fs.createReadStream(filename).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  const errors = [];
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/api/transactions') && route.request().method() === 'POST') { checkouts.push({ body: route.request().postDataJSON(), key: route.request().headers()['idempotency-key'] }); return route.fulfill({ json: { success: true, data: transaction(999), idempotentReplay: true } }); }
    if (url.pathname.includes('/api/')) { calls.push(url); return route.fulfill({ json: fixture(url), headers: { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' } }); }
    if (url.origin === origin || url.protocol === 'data:') return route.continue();
    return route.abort();
  });
  await context.addInitScript(({ user, settings }) => {
    localStorage.setItem('pos-storage', JSON.stringify({ state: { user, settings, license: { isActive: true }, isAuthenticated: true }, version: 2 }));
    localStorage.setItem('litepos_last_activity', String(Date.now()));
  }, { user, settings });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(origin + '/stock/');
    const stock = page.getByRole('link', { name: 'Riwayat Stok', exact: true });
    await stock.waitFor(); assert.equal(await stock.getAttribute('aria-current'), 'page');
    assert.match(await page.getByRole('button', { name: 'Produk & Stok' }).getAttribute('class'), /bg-blue-50/);
    await page.getByRole('button', { name: 'Produk & Stok' }).click();
    await page.getByRole('link', { name: 'Transaksi', exact: true }).click();
    await page.waitForURL('**/transactions/');
    assert.doesNotMatch(await page.getByRole('button', { name: 'Produk & Stok' }).getAttribute('class'), /bg-blue-50/);
    await page.goBack(); await stock.waitFor(); assert.equal(await stock.getAttribute('aria-current'), 'page');
    await page.screenshot({ path: path.join(artifacts, 'stock-active.png') });
    await page.goto(origin + '/reports/');
    await page.getByText('145 data · Halaman 1 dari 8').waitFor();
    await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
    await page.getByText('145 data · Halaman 2 dari 8').waitFor();
    await page.getByRole('button', { name: 'Shift', exact: true }).click();
    await page.getByText('45 data · Halaman 1 dari 3').waitFor();
    await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
    await page.getByText('45 data · Halaman 2 dari 3').waitFor();
    await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
    await page.getByText('45 data · Halaman 3 dari 3').waitFor();
    assert.equal(await page.locator('tbody tr').count(), 5);
    await page.screenshot({ path: path.join(artifacts, 'shift-last-page.png') });
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: /CSV/ }).click();
    const download = await downloadEvent;
    const csv = fs.readFileSync(await download.path(), 'utf8');
    assert.match(csv, /Kasir 1/); assert.match(csv, /Kasir 45/);
    assert(calls.some(url => url.pathname.endsWith('/reports/shift') && url.searchParams.get('limit') === '100'));
    await page.getByRole('button', { name: 'Transaksi', exact: true }).click();
    await page.getByText('145 data · Halaman 1 dari 8').waitFor();
    await page.getByText('INV/20261027/K01/0001', { exact: true }).click();
    await page.getByText('Nasi Uji', { exact: true }).first().waitFor();
    await page.getByRole('button', { name: /(Share|Bagikan) WhatsApp|Siapkan Share/i }).click();
    const dialog = page.getByRole('dialog', { name: 'Bagikan nota ke WhatsApp' }); await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Pelanggan Uji · 081234567890' }).click();
    assert.equal(await dialog.getByLabel('Nomor WhatsApp tujuan').inputValue(), '081234567890');
    await page.evaluate(() => { window.__waTarget = null; window.open = url => { window.__waTarget = url; }; });
    await dialog.getByRole('button', { name: 'Buka chat dengan nota teks' }).click();
    const target = await page.evaluate(() => window.__waTarget);
    assert(target.startsWith('https://wa.me/6281234567890?text='));
    assert(decodeURIComponent(target).includes('Nasi Uji'));
    await page.screenshot({ path: path.join(artifacts, 'whatsapp-contact.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await dialog.isVisible());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(origin + '/shifts/');
    await page.getByText('45 data · Halaman 1 dari 3').waitFor();
    await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
    await page.getByText('45 data · Halaman 2 dari 3').waitFor();
    settings.enableShift = false;
    const pending = { body: { userId: 1, deviceKey: 'fixture-device-key-123456', items: [{ productId: 1, qty: 1 }], payment: { type: 'CASH', amount: 23000 } }, key: 'fixture-checkout-key-123456' };
    pending.fingerprint = JSON.stringify(pending.body);
    await page.evaluate(pending => localStorage.setItem('litepos-pending-checkout-v1:1', JSON.stringify(pending)), pending);
    await page.goto(origin + '/pos/');
    await page.getByRole('button', { name: 'Periksa dan lanjutkan checkout sebelumnya' }).click();
    await page.locator('.swal2-confirm').click();
    await page.waitForURL('**/transactions/');
    assert.equal(checkouts.length, 1);
    assert.equal(checkouts[0].key, pending.key);
    assert.deepEqual(checkouts[0].body, pending.body);
    assert.equal(await page.evaluate(() => localStorage.getItem('litepos-pending-checkout-v1:1')), null);
    assert.deepEqual(errors, []);
    console.log('PASS: route highlight, submenu/back, transaction/shift pagination, all-page CSV export, full receipt detail, unsaved WhatsApp number, mobile, recovery of persisted checkout with the same key/body, zero page errors.');
  } catch (error) { await page.screenshot({ path: path.join(artifacts, 'failure.png') }); console.error('BROWSER URL', page.url(), 'ERRORS', errors, 'TEXT', (await page.locator('body').innerText()).slice(0, 1500)); throw error; } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
