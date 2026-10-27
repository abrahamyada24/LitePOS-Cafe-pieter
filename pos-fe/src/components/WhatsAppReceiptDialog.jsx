"use client";
import { useEffect, useState } from 'react';
import { buildReceiptText } from '@/utils/receiptText';

export default function WhatsAppReceiptDialog({ open, onClose, transaction, store, paperWidthMm, showLitePosBranding, onShareImage, imageDisabled }) {
  const [phone, setPhone] = useState('');
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    let active = true;
    setPhone(transaction?.customer?.phone || transaction?.customerPhone || '');
    setSearch(''); setError(''); setContacts([]);
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');
    fetch(base + '/api/customers', { credentials: 'include', headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
      .then(response => response.json()).then(payload => { if (active && payload.success) setContacts(payload.data.filter(contact => contact.phone)); })
      .catch(() => { if (active) setError('Kontak belum dapat dimuat. Nomor tetap bisa diisi manual.'); });
    return () => { active = false; };
  }, [open, transaction]);
  if (!open) return null;
  const openChat = () => {
    let target = phone.replace(/[\s()+-]/g, '');
    if (target.startsWith('0')) target = '62' + target.slice(1);
    else if (target.startsWith('8')) target = '62' + target;
    if (!/^\d{9,15}$/.test(target)) { setError('Pilih pelanggan atau isi nomor WhatsApp yang valid.'); return; }
    const text = buildReceiptText({ transaction, store, paperWidthMm, showLitePosBranding });
    window.open('https://wa.me/' + target + '?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
  };
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Bagikan nota ke WhatsApp">
    <div className="w-full max-w-md rounded-2xl bg-white p-5 text-gray-900">
      <h3 className="font-bold text-lg">Bagikan nota ke WhatsApp</h3>
      <p className="text-sm text-gray-600 my-2">Pilih kontak pelanggan aplikasi atau isi nomor tanpa menyimpannya di perangkat.</p>
      <input aria-label="Cari kontak pelanggan" value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari nama atau nomor" className="w-full rounded-lg border p-2" />
      <div className="max-h-40 overflow-y-auto my-2">{contacts.filter(contact => (contact.name + contact.phone).toLowerCase().includes(search.toLowerCase())).map(contact => <button key={contact.id} onClick={() => { setPhone(contact.phone); setError(''); }} className="block w-full text-left border-b p-2">{contact.name} · {contact.phone}</button>)}</div>
      <input aria-label="Nomor WhatsApp tujuan" type="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="08… atau +62…" className="w-full rounded-lg border p-2 mb-3" />
      {error && <p role="alert" className="text-sm text-red-700 mb-2">{error}</p>}
      <button onClick={openChat} className="w-full rounded-lg bg-green-600 p-3 text-white font-bold">Buka chat dengan nota teks</button>
      <p className="text-xs text-gray-500 my-2">Untuk gambar, gunakan Bagikan gambar atau Unduh lalu lampirkan di chat tujuan. Browser tidak menetapkan penerima gambar otomatis.</p>
      <button onClick={onShareImage} disabled={imageDisabled} className="rounded-lg border p-2 mr-2">Bagikan gambar</button>
      <button onClick={onClose} className="rounded-lg border p-2">Tutup</button>
    </div>
  </div>;
}
