"use client";

import { Minus, Plus, PlusCircle, X } from 'lucide-react';

export default function AddonModal({
  isOpen,
  product,
  quantities,
  setQuantities,
  notes,
  setNotes,
  onClose,
  onConfirm,
}) {
  if (!isOpen || !product) return null;

  const addons = Array.isArray(product.addons) ? product.addons : [];
  const selectedTotal = addons
    .reduce((total, addon) => total + (Number(addon.price || 0) * Number(quantities[Number(addon.id)] || 0)), 0);

  const updateQuantity = (addonId, delta) => {
    const normalizedId = Number(addonId);
    setQuantities(current => {
      const nextQuantity = Math.min(99, Math.max(0, Number(current[normalizedId] || 0) + delta));
      const next = { ...current };
      if (nextQuantity === 0) delete next[normalizedId];
      else next[normalizedId] = nextQuantity;
      return next;
    });
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
            const quantity = Number(quantities[Number(addon.id)] || 0);
            return (
              <div
                key={addon.id}
                className={`flex w-full items-center gap-3 rounded-2xl border p-4 transition-colors ${quantity > 0 ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}
              >
                <span className="min-w-0 flex-1 font-bold text-gray-800">{addon.name}</span>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-black text-blue-600">+ Rp {Number(addon.price || 0).toLocaleString('id-ID')}</p>
                  <div className="mt-2 flex items-center overflow-hidden rounded-xl border border-blue-200 bg-white">
                    <button type="button" onClick={() => updateQuantity(addon.id, -1)} disabled={quantity === 0} className="flex h-9 w-9 items-center justify-center text-gray-600 disabled:text-gray-300" aria-label={`Kurangi ${addon.name}`}>
                      <Minus size={15} />
                    </button>
                    <span className="w-8 text-center text-sm font-black text-gray-900">{quantity}</span>
                    <button type="button" onClick={() => updateQuantity(addon.id, 1)} disabled={quantity >= 99} className="flex h-9 w-9 items-center justify-center text-blue-600 disabled:text-gray-300" aria-label={`Tambah ${addon.name}`}>
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
              </div>
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
