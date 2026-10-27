export default function ReportPagination({ meta, onChange, disabled }) {
  if (!meta) return null;
  return <nav aria-label="Halaman laporan" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm">
    <span>{meta.total} data · Halaman {meta.page} dari {meta.totalPages}</span>
    <div className="flex gap-2">
      <button type="button" disabled={disabled || meta.page <= 1} onClick={() => onChange(meta.page - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Sebelumnya</button>
      <button type="button" disabled={disabled || meta.page >= meta.totalPages} onClick={() => onChange(meta.page + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Berikutnya</button>
    </div>
  </nav>;
}
