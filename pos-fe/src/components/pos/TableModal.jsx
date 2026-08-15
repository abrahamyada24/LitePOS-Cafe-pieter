"use client";

import { X, Utensils, CheckCircle2 } from 'lucide-react';

export default function TableModal({
    isOpen,
    onClose,
    tables,
    selectedTable,
    setSelectedTable
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-3xl shrink-0">
                    <div>
                        <h3 className="font-bold text-gray-800 text-lg">Pilih Meja</h3>
                        <p className="text-xs text-gray-500 mt-1">Boleh dilewati bila meja belum ditentukan</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors bg-white shadow-sm">
                        <X size={20} />
                    </button>
                </div>

                {/* List Meja */}
                <div className="flex-1 overflow-y-auto p-4">
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedTable(null);
                            onClose();
                        }}
                        className={`mb-4 w-full rounded-2xl border-2 p-3 text-left transition-colors flex items-center justify-between gap-3 ${!selectedTable ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-blue-300 hover:bg-gray-50'}`}
                    >
                        <div>
                            <span className={`block text-sm font-bold ${!selectedTable ? 'text-blue-700' : 'text-gray-700'}`}>Tanpa meja</span>
                            <span className="text-xs text-gray-500">Lanjutkan pesanan tanpa memilih meja</span>
                        </div>
                        {!selectedTable && <CheckCircle2 size={18} className="shrink-0 text-blue-500" />}
                    </button>

                    {tables.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                            <Utensils size={48} className="mb-4 opacity-20" />
                            <p>Tidak ada meja yang tersedia.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {tables.map((table) => {
                                const isSelected = selectedTable?.id === table.id || selectedTable?.number === table.number;
                                return (
                                    <button
                                        key={table.id}
                                        onClick={() => setSelectedTable(table)}
                                        className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all relative overflow-hidden group
                                            ${isSelected
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-100 hover:border-blue-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className={`p-3 rounded-full ${isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-500'}`}>
                                            <Utensils size={24} />
                                        </div>
                                        <div className="text-center">
                                            <span className={`block font-bold text-lg ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                                                {table.number}
                                            </span>
                                            <span className={`text-[10px] uppercase font-bold tracking-wider ${isSelected ? 'text-blue-500' : 'text-green-500'}`}>
                                                Tersedia
                                            </span>
                                        </div>
                                        {isSelected && (
                                            <div className="absolute top-2 right-2 text-blue-500">
                                                <CheckCircle2 size={16} fill="currentColor" className="text-white" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Action */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3 shrink-0 rounded-b-3xl">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-[2] py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-blue-600 shadow-xl shadow-gray-200 transition-all flex justify-center items-center gap-2"
                    >
                        Konfirmasi
                    </button>
                </div>
            </div>
        </div>
    );
}
