"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Check,
  CheckCircle2,
  ChefHat,
  ClipboardCheck,
  RefreshCw,
  XCircle,
} from "lucide-react";

const STEPS = [
  { status: "NEW", label: "Diterima" },
  { status: "PREPARING", label: "Diproses" },
  { status: "READY", label: "Siap" },
];

const STATUS_META = {
  NEW: {
    title: "Pesanan diterima",
    message: "Pesanan Anda sudah masuk ke antrean dapur.",
    icon: ClipboardCheck,
    tone: "emerald",
  },
  PREPARING: {
    title: "Pesanan sedang diproses",
    message: "Dapur sedang menyiapkan pesanan Anda.",
    icon: ChefHat,
    tone: "blue",
  },
  READY: {
    title: "Pesanan Anda siap diantar",
    message: "Mohon tunggu, petugas akan mengantarkannya ke meja.",
    icon: BellRing,
    tone: "emerald",
  },
  COMPLETED: {
    title: "Pesanan selesai",
    message: "Pesanan sudah diserahkan. Selamat menikmati.",
    icon: CheckCircle2,
    tone: "emerald",
  },
  CANCELLED: {
    title: "Pesanan dibatalkan",
    message: "Silakan hubungi petugas apabila Anda memerlukan bantuan.",
    icon: XCircle,
    tone: "red",
  },
};

const TONE_CLASS = {
  emerald: {
    icon: "bg-emerald-50 text-emerald-700",
    ring: "bg-emerald-300",
  },
  blue: {
    icon: "bg-blue-50 text-blue-700",
    ring: "bg-blue-300",
  },
  red: {
    icon: "bg-red-50 text-red-600",
    ring: "bg-red-300",
  },
};

const formatRupiah = (value) => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
}).format(Number(value) || 0);

export default function OrderStatusTracker({ apiUrl, order, onAddOrder, kitchenTrackingEnabled }) {
  const [trackedOrder, setTrackedOrder] = useState(order);
  const [connectionError, setConnectionError] = useState(false);
  const status = String(trackedOrder?.status || "NEW").toUpperCase();
  const meta = kitchenTrackingEnabled
    ? STATUS_META[status] || STATUS_META.NEW
    : { ...STATUS_META.NEW, message: "Pesanan Anda sudah masuk ke kasir." };
  const Icon = meta.icon;
  const tone = TONE_CLASS[meta.tone];
  const terminal = status === "COMPLETED" || status === "CANCELLED";

  const activeStep = useMemo(() => {
    if (status === "PREPARING") return 1;
    if (status === "READY" || status === "COMPLETED") return 2;
    return 0;
  }, [status]);

  useEffect(() => {
    if (!order?.orderCode || !kitchenTrackingEnabled) return undefined;
    let active = true;
    let timer;

    const refreshStatus = async () => {
      try {
        const response = await fetch(
          `${apiUrl}/api/catalog/table-order/${encodeURIComponent(order.orderCode)}/status`,
          { cache: "no-store" },
        );
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.message || "Status belum tersedia.");
        if (!active) return;
        setTrackedOrder((current) => ({ ...current, ...payload.data }));
        setConnectionError(false);
        if (["COMPLETED", "CANCELLED"].includes(String(payload.data.status).toUpperCase())) {
          clearInterval(timer);
        }
      } catch {
        if (active) setConnectionError(true);
      }
    };

    refreshStatus();
    timer = setInterval(refreshStatus, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [apiUrl, kitchenTrackingEnabled, order?.orderCode]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white px-5 py-7 sm:py-10">
      <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center text-center">
        <div key={status} className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center">
          {kitchenTrackingEnabled && !terminal && status !== "CANCELLED" && (
            <span className={`absolute inset-2 rounded-full opacity-40 animate-ping ${tone.ring}`} />
          )}
          <span className={`relative flex h-16 w-16 items-center justify-center rounded-full ${tone.icon}`}>
            <Icon size={31} strokeWidth={2.2} />
          </span>
        </div>

        <div aria-live="polite" key={`copy-${status}`}>
          <h2 className="text-2xl font-black text-gray-950">{meta.title}</h2>
          <p className="mt-2 text-sm font-medium leading-5 text-gray-500">{meta.message}</p>
        </div>

        {kitchenTrackingEnabled && status !== "CANCELLED" && (
          <div className="mt-7 grid grid-cols-3">
            {STEPS.map((step, index) => {
              const reached = index <= activeStep;
              const passed = index < activeStep || status === "COMPLETED";
              const current = index === activeStep && status !== "COMPLETED";
              return (
                <div key={step.status} className="relative flex min-w-0 flex-col items-center">
                  {index < STEPS.length - 1 && (
                    <span className={`absolute left-1/2 top-4 h-1 w-full transition-colors duration-700 ${index < activeStep ? "bg-emerald-600" : "bg-stone-200"}`} />
                  )}
                  <span className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-500 ${reached ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-200 bg-white text-stone-300"} ${current ? "ring-4 ring-emerald-100" : ""}`}>
                    {passed ? <Check size={16} strokeWidth={3} /> : <span className="text-xs font-black">{index + 1}</span>}
                  </span>
                  <span className={`mt-2 text-[11px] font-black ${reached ? "text-gray-900" : "text-gray-400"}`}>{step.label}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-7 rounded-lg border border-stone-200 bg-stone-50 p-4 text-left">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase text-gray-500">Nomor antrean</p>
              <p className="mt-1 text-3xl font-black text-emerald-700">{trackedOrder.queueLabel || "-"}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase text-gray-500">Meja</p>
              <p className="mt-1 text-lg font-black text-gray-950">{trackedOrder.tableNumber || "-"}</p>
            </div>
          </div>
          <div className="my-4 h-px bg-stone-200" />
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase text-gray-500">Kode order</p>
              <p className="mt-1 break-all text-xs font-black text-gray-900">{trackedOrder.orderCode}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-black uppercase text-gray-500">Total</p>
              <p className="mt-1 text-base font-black text-gray-950">{formatRupiah(trackedOrder.total ?? trackedOrder.grandTotal)}</p>
            </div>
          </div>
        </div>

        <div className={`mt-4 flex min-h-5 items-center justify-center gap-2 text-xs font-bold ${connectionError ? "text-amber-600" : "text-emerald-700"}`}>
          {connectionError ? <RefreshCw size={14} /> : <span className={`h-2 w-2 rounded-full bg-emerald-600 ${kitchenTrackingEnabled && !terminal ? "animate-pulse" : ""}`} />}
          {connectionError
            ? "Mencoba menghubungkan kembali"
            : !kitchenTrackingEnabled
              ? "Masuk ke kasir"
              : terminal
                ? "Status akhir pesanan"
                : "Status diperbarui otomatis"}
        </div>

        <button
          type="button"
          onClick={onAddOrder}
          className="mt-6 h-12 w-full rounded-lg bg-gray-950 font-black text-white transition-colors hover:bg-gray-800"
        >
          {status === "CANCELLED" ? "Kembali ke katalog" : "Tambah Pesanan"}
        </button>
      </div>
    </div>
  );
}
