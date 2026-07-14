"use client";

import React, { useEffect, useState } from "react";
import { ArrowRight, QrCode } from "lucide-react";
import { useStore } from "../../store/useStore";

export default function OrderMejaPage() {
  const [tableNumber, setTableNumber] = useState("");
  const settings = useStore(state => state.settings);
  const fetchDataMaster = useStore(state => state.fetchDataMaster);

  useEffect(() => {
    if (!settings) fetchDataMaster();
  }, [fetchDataMaster, settings]);

  const openTableOrder = (event) => {
    event.preventDefault();
    const value = tableNumber.trim();
    if (!value) return;
    window.location.href = `/katalog?table=${encodeURIComponent(value)}`;
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <form
        onSubmit={openTableOrder}
        className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
            <QrCode size={22} className="text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">Order Meja</h1>
            <p className="text-sm text-gray-500">Masukkan nomor meja pelanggan</p>
          </div>
        </div>

        {settings && !settings.enableTableOrder ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            Order meja sedang dinonaktifkan dari Pengaturan Fitur.
          </div>
        ) : (
          <>
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
              Nomor Meja
            </label>
            <input
              value={tableNumber}
              onChange={(event) => setTableNumber(event.target.value.toUpperCase())}
              placeholder="Contoh: T01"
              className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 font-bold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />

            <button
              type="submit"
              disabled={!tableNumber.trim()}
              className="mt-5 w-full h-12 rounded-xl bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Buka Menu
              <ArrowRight size={18} />
            </button>
          </>
        )}
      </form>
    </main>
  );
}
