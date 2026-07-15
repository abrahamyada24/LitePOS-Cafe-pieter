"use client";

import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Mail, ShieldCheck, User } from 'lucide-react';
import UserModal from '@/components/UserModal';
import { showAlert } from '@/utils/swal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const res = await fetch(`${API_URL}/api/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();

            if (json.success) {
                setUsers(json.data);
            }
        } catch (error) {
            console.error("Gagal load users:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);


    const handleAdd = () => {
        setEditingUser(null);
        setIsModalOpen(true);
    };

    const handleEdit = (user, e) => {
        e.stopPropagation();
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        const confirmed = await showAlert.confirmDanger('Hapus akses pegawai?', 'Pegawai tidak akan dapat login lagi.', 'Ya, Hapus Akses');
        if (confirmed) {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/api/users/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const json = await res.json();

                if (!res.ok || !json.success) throw new Error(json.message || json.error);
                await fetchUsers();
                showAlert.success('Akses dihapus', 'Akun pegawai berhasil dihapus.');
            } catch (error) {
                showAlert.error('Gagal menghapus akses', error.message || 'Coba lagi.');
            }
        }
    };

    const handleSaveUser = async (formData) => {
        const token = localStorage.getItem('token');

        const data = new FormData();
        data.append('name', formData.name);
        data.append('email', formData.email);
        data.append('role', formData.role);
        data.append('isActive', formData.isActive);

        if (formData.password) data.append('password', formData.password);
        if (formData.imageFile) data.append('image', formData.imageFile);

        try {
            let url, method;

            if (editingUser) {
                url = `${API_URL}/api/users/${editingUser.id}`;
                method = 'PUT';
            } else {
                url = `${API_URL}/api/auth/register`;
                method = 'POST';
            }

            const res = await fetch(url, {
                method: method,
                headers: { 'Authorization': `Bearer ${token}` },
                body: data
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.message || "Gagal menyimpan");
            }

            fetchUsers();
            setIsModalOpen(false);
        } catch (error) {
            showAlert.error('Gagal menyimpan pegawai', error.message);
        }
    };

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    const getImageUrl = (path) => path ? (path.startsWith('http') ? path : `${API_URL}${path}`) : null;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Tim & Pengguna</h2>
                    <p className="text-gray-400 text-sm">Kelola akses dan profil staff.</p>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-none">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Cari staff..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full sm:w-64 pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all text-sm"
                        />
                    </div>
                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 shadow-sm transition-colors whitespace-nowrap"
                    >
                        <Plus size={18} /> <span className="hidden sm:inline">Tambah</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div onClick={handleAdd} className="border-2 border-dashed border-gray-300 rounded-3xl flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer bg-gray-50/50 group h-64">
                    <div className="p-3 bg-white rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                        <Plus size={24} />
                    </div>
                    <span className="font-medium text-sm">Undang Staff Baru</span>
                </div>

                {filteredUsers.map((user) => (
                    <div key={user.id} className="group relative rounded-3xl overflow-hidden border border-gray-100 bg-white hover:shadow-xl transition-all duration-300 cursor-pointer h-64 flex flex-col">
                        <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => handleEdit(user, e)} className="p-2 rounded-full bg-white/90 backdrop-blur-sm text-gray-600 hover:text-blue-500 shadow-sm hover:bg-white transition-colors">
                                <Edit size={16} />
                            </button>
                            <button onClick={(e) => handleDelete(user.id, e)} className="p-2 rounded-full bg-white/90 backdrop-blur-sm text-gray-600 hover:text-red-500 shadow-sm hover:bg-white transition-colors">
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div className="p-5 flex flex-col h-full items-center text-center justify-center">
                            <div className="relative mb-3">
                                <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-gray-50 shadow-sm">
                                    {user.imageUrl ? (
                                        <img src={getImageUrl(user.imageUrl)} alt={user.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400"><User size={32} /></div>
                                    )}
                                </div>
                                <span className={`absolute bottom-1 right-1 w-4 h-4 border-2 border-white rounded-full ${user.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                            </div>

                            <h3 className="font-bold text-gray-800 text-lg mb-1">{user.name}</h3>

                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3 ${user.role === 'OWNER' ? 'bg-green-100 text-green-700' : user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                {user.role === 'CASHIER' ? 'STAFF' : user.role}
                            </span>

                            <div className="flex items-center gap-1 text-gray-400 text-xs">
                                <Mail size={12} /> {user.email}
                            </div>
                        </div>

                        {user.role === 'ADMIN' && (
                            <div className="absolute top-4 left-4">
                                <span className="p-1.5 bg-purple-500 text-white rounded-lg shadow-sm">
                                    <ShieldCheck size={14} />
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <UserModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveUser}
                initialData={editingUser}
            />
        </div>
    );
}
