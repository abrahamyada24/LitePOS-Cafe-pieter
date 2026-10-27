const parseReportQuery = (query = {}, user = {}, defaultLimit = 20) => {
  const page = Math.max(1, Math.trunc(Number.isFinite(Number(query.page)) ? Number(query.page) || 1 : 1));
  const limit = Math.max(1, Math.min(100, Math.trunc(Number(query.limit) || defaultLimit)));
  const where = String(user.role || '').toUpperCase() === 'CASHIER' ? { userId: user.id } : {};
  const now = new Date();
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  let start = query.startDate;
  let end = query.endDate;
  if (!start && query.period) {
    end = day;
    if (query.period === 'year') start = `${day.slice(0, 4)}-01-01`;
    else if (query.period === 'month') start = `${day.slice(0, 7)}-01`;
    else if (query.period === 'week') start = new Date(new Date(`${day}T00:00:00Z`).getTime() - 6 * 86400000).toISOString().slice(0, 10);
    else start = day;
  }
  if (start || end) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(end || '') || start > end) throw new Error('Rentang tanggal tidak valid.');
    const gte = new Date(`${start}T00:00:00+07:00`);
    const lt = new Date(new Date(`${end}T00:00:00+07:00`).getTime() + 86400000);
    if (!Number.isFinite(gte.getTime()) || !Number.isFinite(lt.getTime())
      || new Date(`${start}T00:00:00Z`).toISOString().slice(0, 10) !== start
      || new Date(`${end}T00:00:00Z`).toISOString().slice(0, 10) !== end) throw new Error('Rentang tanggal tidak valid.');
    where.openedAt = { gte, lt };
  }
  return { page, limit, skip: (page - 1) * limit, where };
};
const pageMeta = (page, limit, total) => ({ page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
module.exports = { parseReportQuery, pageMeta };
