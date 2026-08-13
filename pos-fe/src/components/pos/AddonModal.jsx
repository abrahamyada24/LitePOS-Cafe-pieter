"use client";

import { Check, PlusCircle, X } from 'lucide-react';

export default function AddonModal({
  isOpen,
  product,
  selectedIds,
  setSelectedIds,
  notes,
  setNotes,
  onClose,
  onConfirm,
}) {
  if (!isOpen || !product) return null;

  const addons = Array.isArray(product.addons) ? product.addons : [];
  const selectedTotal = addons
    .filter(addon => selectedIds.includes(Number(addon.id)))
    .reduce((total, addon) => total + Number(addon.price || 0), 0);

  const toggleAddon = (addonId) => {
    const normalizedId = Number(addonId);
    setSelectedIds(current => current.includes(normalizedId)
      ? current.filter(id => id !== normalizedId)
      : [...current, normalizedId]);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-blue-600">
              <PlusCircle size={18} />
              <p className="text-xs font-black uppercase tracking-wider">Pilih Add-on</p>
            </div>
            <h2 className="truncate text-xl font-black text-gray-900">{product.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200" aria-label="Tutup pilihan add-on">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
          {addons.map(addon => {
            const checked = selectedIds.includes(Number(addon.id));
            return (
              <button
                key={addon.id}
                type="button"
                onClick={() => toggleAddon(addon.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-200'}`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checked ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-transparent'}`}>
                  <Check size={13} strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1 font-bold text-gray-800">{addon.name}</span>
                <span className="shrink-0 text-sm font-black text-blue-600">+ Rp {Number(addon.price || 0).toLocaleString('id-ID')}</span>
              </button>
            );
          })}

          <label className="block pt-2">
            <span className="mb-2 block text-xs font-black uppercase tracking-wider text-gray-500">Catatan tambahan (opsional)</span>
            <textarea
              value={notes}
              onChange={event => setNotes(event.target.value)}
              maxLength={250}
              rows={3}
              placeholder="Contoh: tanpa gula, es sedikit"
              className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-blue-400 focus:bg-white"
            />
          </label>
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-6 py-5">
          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="font-bold text-gray-500">Tambahan harga</span>
            <span className="text-lg font-black text-blue-600">Rp {selectedTotal.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 bg-white py-3 font-bold text-gray-600 hover:bg-gray-100">Batal</button>
            <button type="button" onClick={onConfirm} className="flex-1 rounded-xl bg-blue-600 py-3 font-black text-white hover:bg-blue-700">Simpan Pilihan</button>
          </div>
        </div>
      </div>
    </div>
  );
}
