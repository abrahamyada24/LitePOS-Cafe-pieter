export const fetchReportPage = async (url, headers, page = 1, limit = 20) => {
  const target = new URL(url, window.location.origin);
  target.searchParams.set('page', String(page));
  target.searchParams.set('limit', String(limit));
  const response = await fetch(target.toString(), { headers, credentials: 'include' });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || payload.error || 'Laporan gagal dimuat.');
  return payload;
};

export const fetchAllReportPages = async (url, headers) => {
  const first = await fetchReportPage(url, headers, 1, 100);
  const rows = [...first.data];
  for (let page = 2; page <= (first.meta?.totalPages || 1); page++) {
    const next = await fetchReportPage(url, headers, page, 100);
    rows.push(...next.data);
  }
  return rows;
};
