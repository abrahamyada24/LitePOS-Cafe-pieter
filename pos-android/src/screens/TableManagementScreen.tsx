import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, Modal, TextInput, ScrollView, useWindowDimensions } from 'react-native';
import tw, { useAppColorScheme } from 'twrnc';
import { getDBConnection } from '../database/db';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const STATUS_OPTIONS = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'] as const;
type TableStatus = typeof STATUS_OPTIONS[number];

const STATUS_CONFIG: Record<TableStatus, { label: string; bg: string; text: string; dot: string }> = {
    AVAILABLE: { label: 'Tersedia', bg: 'bg-green-50 border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
    OCCUPIED: { label: 'Terisi', bg: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
    RESERVED: { label: 'Dipesan', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
    CLEANING: { label: 'Dibersihkan', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
};

export default function TableManagementScreen({ navigation }: any) {
    useAppColorScheme(tw);
    const { width } = useWindowDimensions();
    const numColumns = width >= 768 ? 4 : 2;

    const [tables, setTables] = useState<any[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [tableNumber, setTableNumber] = useState('');
    const [tableName, setTableName] = useState('');
    const [tableCapacity, setTableCapacity] = useState('4');
    const [showStatusPicker, setShowStatusPicker] = useState(false);
    const [statusPickerTableId, setStatusPickerTableId] = useState<number | null>(null);

    const loadTables = useCallback(async () => {
        try {
            const db = await getDBConnection();
            const [res] = await db.executeSql('SELECT * FROM dine_tables ORDER BY number ASC');
            const arr: any[] = [];
            for (let i = 0; i < res.rows.length; i++) arr.push(res.rows.item(i));
            setTables(arr);
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => { loadTables(); }, [loadTables]);
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', loadTables);
        return unsubscribe;
    }, [navigation, loadTables]);

    const resetForm = () => {
        setEditId(null);
        setTableNumber('');
        setTableName('');
        setTableCapacity('4');
    };

    const openForm = (table?: any) => {
        if (table) {
            setEditId(table.id);
            setTableNumber(table.number);
            setTableName(table.name || '');
            setTableCapacity(String(table.capacity || 4));
        } else {
            resetForm();
        }
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!tableNumber.trim()) {
            Alert.alert('Validasi', 'Nomor meja wajib diisi.');
            return;
        }
        try {
            const db = await getDBConnection();
            const cap = parseInt(tableCapacity || '4', 10);
            if (editId) {
                await db.executeSql(
                    'UPDATE dine_tables SET number = ?, name = ?, capacity = ?, isSynced = 0 WHERE id = ?',
                    [tableNumber.trim(), tableName.trim() || null, cap, editId]
                );
            } else {
                // Check duplicate number
                const [dup] = await db.executeSql('SELECT id FROM dine_tables WHERE number = ?', [tableNumber.trim()]);
                if (dup.rows.length > 0) {
                    Alert.alert('Duplikat', 'Nomor meja sudah digunakan.');
                    return;
                }
                await db.executeSql(
                    'INSERT INTO dine_tables (number, name, capacity, status) VALUES (?, ?, ?, ?)',
                    [tableNumber.trim(), tableName.trim() || null, cap, 'AVAILABLE']
                );
            }
            setShowForm(false);
            resetForm();
            loadTables();
        } catch (e) {
            Alert.alert('Error', 'Gagal menyimpan meja.');
        }
    };

    const handleDelete = (table: any) => {
        Alert.alert('Hapus Meja', `Hapus meja ${table.number}?`, [
            { text: 'Batal', style: 'cancel' },
            {
                text: 'Hapus', style: 'destructive', onPress: async () => {
                    try {
                        const db = await getDBConnection();
                        await db.executeSql('DELETE FROM dine_tables WHERE id = ?', [table.id]);
                        loadTables();
                    } catch (e) { Alert.alert('Error', 'Gagal menghapus meja.'); }
                }
            }
        ]);
    };

    const handleStatusChange = async (tableId: number, status: TableStatus) => {
        try {
            const db = await getDBConnection();
            await db.executeSql('UPDATE dine_tables SET status = ?, isSynced = 0 WHERE id = ?', [status, tableId]);
            setShowStatusPicker(false);
            setStatusPickerTableId(null);
            loadTables();
        } catch (e) { Alert.alert('Error', 'Gagal mengubah status.'); }
    };

    const statusCounts = STATUS_OPTIONS.reduce((acc, s) => {
        acc[s] = tables.filter(t => t.status === s).length;
        return acc;
    }, {} as Record<TableStatus, number>);

    const renderTable = ({ item }: { item: any }) => {
        const cfg = STATUS_CONFIG[item.status as TableStatus] || STATUS_CONFIG.AVAILABLE;
        return (
            <View style={tw`flex-1 m-1.5 ${cfg.bg} border rounded-2xl p-4 min-h-[140px]`}>
                {/* Header */}
                <View style={tw`flex-row justify-between items-start mb-2`}>
                    <Text style={tw`text-2xl font-black ${cfg.text}`}>{item.number}</Text>
                    <View style={tw`flex-row gap-1`}>
                        <TouchableOpacity onPress={() => openForm(item)} style={tw`p-1.5 rounded-lg bg-white/60`}>
                            <Icon name="pencil" size={13} color={tw.color('gray-600')} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(item)} style={tw`p-1.5 rounded-lg bg-white/60`}>
                            <Icon name="delete-outline" size={13} color={tw.color('red-500')} />
                        </TouchableOpacity>
                    </View>
                </View>

                {item.name ? <Text style={tw`text-xs font-medium ${cfg.text} opacity-80 mb-1`}>{item.name}</Text> : null}

                <View style={tw`flex-row items-center mb-3`}>
                    <Icon name="account-multiple" size={11} color={tw.color('gray-400')} style={tw`mr-1`} />
                    <Text style={tw`text-xs text-gray-500`}>{item.capacity} kursi</Text>
                </View>

                {/* Status badge - tap to change */}
                <TouchableOpacity
                    onPress={() => { setStatusPickerTableId(item.id); setShowStatusPicker(true); }}
                    style={tw`bg-white/70 px-3 py-1.5 rounded-full self-start flex-row items-center border border-gray-200/50`}
                >
                    <View style={tw`w-2 h-2 rounded-full ${cfg.dot} mr-1.5`} />
                    <Text style={tw`text-[11px] font-bold ${cfg.text}`}>{cfg.label}</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={tw`flex-1 bg-gray-50 dark:bg-gray-900`}>
            {/* Header */}
            <View style={tw`bg-white dark:bg-gray-800 px-4 py-3 flex-row items-center border-b border-gray-200 dark:border-gray-700`}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={tw`p-2 mr-2`}>
                    <Icon name="arrow-left" size={24} color={tw.color('gray-800')} />
                </TouchableOpacity>
                <View style={tw`flex-1`}>
                    <Text style={tw`text-xl font-black text-gray-800 dark:text-gray-100`}>Manajemen Meja</Text>
                    <Text style={tw`text-xs text-gray-500 dark:text-gray-400`}>{tables.length} meja terdaftar</Text>
                </View>
                <TouchableOpacity
                    style={tw`bg-green-600 flex-row items-center px-3 py-2 rounded-xl`}
                    onPress={() => openForm()}
                >
                    <Icon name="plus" size={16} color="white" style={tw`mr-1`} />
                    <Text style={tw`text-white font-bold text-xs`}>Tambah</Text>
                </TouchableOpacity>
            </View>

            {/* Status summary */}
            <View style={tw`bg-white dark:bg-gray-800 px-4 py-2.5 flex-row border-b border-gray-100 dark:border-gray-700`}>
                {STATUS_OPTIONS.map(s => {
                    const cfg = STATUS_CONFIG[s];
                    return (
                        <View key={s} style={tw`flex-row items-center mr-4`}>
                            <View style={tw`w-2.5 h-2.5 rounded-full ${cfg.dot} mr-1.5`} />
                            <Text style={tw`text-[10px] font-bold text-gray-600 dark:text-gray-400`}>
                                {cfg.label} ({statusCounts[s]})
                            </Text>
                        </View>
                    );
                })}
            </View>

            {/* Table Grid */}
            <FlatList
                data={tables}
                numColumns={numColumns}
                key={`cols-${numColumns}`}
                keyExtractor={item => String(item.id)}
                contentContainerStyle={tw`p-2 pb-10`}
                ListEmptyComponent={() => (
                    <View style={tw`items-center py-20`}>
                        <Icon name="silverware-fork-knife" size={48} color={tw.color('gray-300')} />
                        <Text style={tw`text-gray-400 font-bold mt-4 text-center`}>Belum ada meja.{'\n'}Klik "Tambah" untuk mulai.</Text>
                    </View>
                )}
                renderItem={renderTable}
            />

            {/* Add/Edit Modal */}
            <Modal visible={showForm} transparent animationType="slide">
                <View style={tw`flex-1 bg-black/50 justify-end`}>
                    <View style={tw`bg-white dark:bg-gray-800 rounded-t-3xl p-6`}>
                        <View style={tw`flex-row justify-between items-center mb-5`}>
                            <Text style={tw`font-black text-xl text-gray-800 dark:text-gray-100`}>
                                {editId ? 'Edit Meja' : 'Tambah Meja Baru'}
                            </Text>
                            <TouchableOpacity onPress={() => { setShowForm(false); resetForm(); }} style={tw`p-2 bg-gray-100 dark:bg-gray-700 rounded-full`}>
                                <Icon name="close" size={20} color={tw.color('gray-600')} />
                            </TouchableOpacity>
                        </View>

                        <Text style={tw`text-xs font-bold text-gray-600 dark:text-gray-300 mb-1`}>Nomor Meja <Text style={tw`text-red-400`}>*</Text></Text>
                        <TextInput
                            style={tw`bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100 font-bold mb-4`}
                            placeholder="Contoh: T01, A1, VIP-1"
                            value={tableNumber}
                            onChangeText={setTableNumber}
                            autoCapitalize="characters"
                        />

                        <Text style={tw`text-xs font-bold text-gray-600 dark:text-gray-300 mb-1`}>Nama Area <Text style={tw`text-gray-400 font-normal`}>(opsional)</Text></Text>
                        <TextInput
                            style={tw`bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100 mb-4`}
                            placeholder="Contoh: Lantai 2, Outdoor, VIP Room"
                            value={tableName}
                            onChangeText={setTableName}
                        />

                        <Text style={tw`text-xs font-bold text-gray-600 dark:text-gray-300 mb-1`}>Kapasitas (kursi)</Text>
                        <TextInput
                            style={tw`bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100 font-bold mb-6`}
                            keyboardType="numeric"
                            placeholder="4"
                            value={tableCapacity}
                            onChangeText={t => setTableCapacity(t.replace(/[^0-9]/g, ''))}
                        />

                        <TouchableOpacity style={tw`bg-green-600 py-4 rounded-xl items-center flex-row justify-center`} onPress={handleSave}>
                            <Icon name="content-save" size={18} color="white" style={tw`mr-2`} />
                            <Text style={tw`font-bold text-white text-lg`}>Simpan Meja</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Status Picker Modal */}
            <Modal visible={showStatusPicker} transparent animationType="fade">
                <View style={tw`flex-1 bg-black/50 justify-center px-6`}>
                    <View style={tw`bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xl`}>
                        <Text style={tw`font-black text-lg text-gray-800 dark:text-gray-100 mb-4`}>Ubah Status Meja</Text>
                        {STATUS_OPTIONS.map(s => {
                            const cfg = STATUS_CONFIG[s];
                            const currentTable = tables.find(t => t.id === statusPickerTableId);
                            const isActive = currentTable?.status === s;
                            return (
                                <TouchableOpacity
                                    key={s}
                                    style={tw`flex-row items-center py-3 px-3 rounded-xl mb-1 ${isActive ? cfg.bg + ' border' : ''}`}
                                    onPress={() => statusPickerTableId && handleStatusChange(statusPickerTableId, s)}
                                >
                                    <View style={tw`w-3 h-3 rounded-full ${cfg.dot} mr-3`} />
                                    <Text style={tw`flex-1 font-bold ${isActive ? cfg.text : 'text-gray-700 dark:text-gray-200'}`}>{cfg.label}</Text>
                                    {isActive && <Text style={tw`text-xs ${cfg.text} font-bold`}>Aktif</Text>}
                                </TouchableOpacity>
                            );
                        })}
                        <TouchableOpacity
                            style={tw`mt-3 py-3 border border-gray-200 dark:border-gray-700 rounded-xl items-center`}
                            onPress={() => { setShowStatusPicker(false); setStatusPickerTableId(null); }}
                        >
                            <Text style={tw`font-bold text-gray-600 dark:text-gray-300`}>Batal</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
