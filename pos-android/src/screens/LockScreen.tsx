import React, { useEffect, useState } from 'react';
import { Alert, BackHandler, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import tw from 'twrnc';
import { useStore } from '../store/useStore';
import { clearAuthSession } from '../services/secureAuthStorage';
import {
    activateLicense,
    licenseToSettings,
    resolveLicenseStatus,
} from '../services/licenseService';
import type { LicenseStatus } from '../services/secureLicenseStorage';

const formatDate = (value?: string | null) => value
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(value))
    : 'Tanpa batas waktu';

export default function LockScreen({ navigation }: any) {
    const user = useStore((state) => state.user);
    const settings = useStore((state) => state.settings);
    const setSettings = useStore((state) => state.setSettings);
    const setUser = useStore((state) => state.setUser);
    const [license, setLicense] = useState<LicenseStatus | null>(null);
    const [activationCode, setActivationCode] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const isOwner = user?.role === 'OWNER';

    const applyLicense = (nextLicense: LicenseStatus) => {
        setLicense(nextLicense);
        setSettings({ ...settings, ...licenseToSettings(nextLicense) });
        if (nextLicense.isActive) navigation.replace('Main');
    };

    const refresh = async () => {
        setIsLoading(true);
        try {
            applyLicense(await resolveLicenseStatus());
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refresh();
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
        return () => subscription.remove();
    }, []);

    const handleActivate = async () => {
        if (!activationCode.trim()) {
            Alert.alert('Kode Belum Diisi', 'Masukkan kode aktivasi dari pengelola LitePOS.');
            return;
        }
        setIsLoading(true);
        try {
            const nextLicense = await activateLicense(activationCode);
            setActivationCode('');
            applyLicense(nextLicense);
            Alert.alert('Lisensi Aktif', 'Lisensi outlet berlaku untuk website dan seluruh Android yang login.');
        } catch (error: any) {
            Alert.alert('Aktivasi Gagal', error?.response?.data?.message || error?.message || 'Kode tidak dapat diproses.');
        } finally {
            setIsLoading(false);
        }
    };

    const switchAccount = async () => {
        await clearAuthSession();
        setUser(null);
        navigation.replace('Login');
    };

    return (
        <SafeAreaView style={tw`flex-1 bg-gray-950 justify-center px-6`}>
            <View style={tw`w-full max-w-md self-center bg-gray-900 border border-gray-800 rounded-3xl p-7`}>
                <View style={tw`w-16 h-16 rounded-2xl bg-red-500/15 items-center justify-center mb-5`}>
                    <Icon name="shield-lock-outline" size={34} color={tw.color('red-400')} />
                </View>
                <Text style={tw`text-2xl font-black text-white`}>Lisensi Outlet Tidak Aktif</Text>
                <Text style={tw`text-sm text-gray-400 leading-5 mt-2`}>
                    Operasional POS dikunci, tetapi akun tetap dapat login untuk memeriksa atau memperpanjang lisensi.
                </Text>

                <View style={tw`bg-gray-800 rounded-2xl p-4 mt-6`}>
                    <Text style={tw`text-[10px] font-black text-gray-500 uppercase`}>Nomor Lisensi</Text>
                    <View style={tw`flex-row items-center mt-1`}>
                        <Text selectable style={tw`flex-1 text-lg font-black text-white tracking-wider`}>
                            {license?.licenseNumber || 'Belum tersedia'}
                        </Text>
                        {license?.licenseNumber ? (
                            <TouchableOpacity onPress={() => Clipboard.setString(license.licenseNumber || '')} style={tw`p-2`}>
                                <Icon name="content-copy" size={18} color={tw.color('gray-300')} />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                    <View style={tw`border-t border-gray-700 mt-3 pt-3 flex-row justify-between`}>
                        <Text style={tw`text-xs text-gray-400`}>Status: {license?.status || 'UNKNOWN'}</Text>
                        <Text style={tw`text-xs text-gray-400`}>Berakhir: {formatDate(license?.expiresAt)}</Text>
                    </View>
                    {license?.offline ? (
                        <Text style={tw`text-[10px] text-amber-400 mt-3`}>Status berasal dari cache offline perangkat.</Text>
                    ) : null}
                </View>

                {isOwner ? (
                    <View style={tw`mt-6`}>
                        <Text style={tw`text-xs font-bold text-gray-300 mb-2`}>Kode Aktivasi</Text>
                        <TextInput
                            value={activationCode}
                            onChangeText={(value) => setActivationCode(value.toUpperCase())}
                            placeholder="LP-XXXX-XXXX-XXXX-XXXX-XXXX"
                            placeholderTextColor={tw.color('gray-600')}
                            autoCapitalize="characters"
                            style={tw`bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white font-bold tracking-wider`}
                        />
                        <TouchableOpacity
                            onPress={handleActivate}
                            disabled={isLoading}
                            style={tw`bg-blue-600 rounded-xl py-4 items-center mt-3 ${isLoading ? 'opacity-60' : ''}`}
                        >
                            <Text style={tw`text-white font-black`}>{isLoading ? 'Memeriksa...' : 'Aktifkan Lisensi Outlet'}</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={tw`bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mt-6`}>
                        <Text style={tw`text-sm text-amber-300 font-bold`}>Masuk sebagai Owner untuk memasukkan kode aktivasi.</Text>
                    </View>
                )}

                <View style={tw`flex-row gap-3 mt-5`}>
                    <TouchableOpacity onPress={refresh} style={tw`flex-1 border border-gray-700 rounded-xl py-3 items-center`}>
                        <Text style={tw`text-gray-300 font-bold`}>Cek Ulang</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={switchAccount} style={tw`flex-1 border border-gray-700 rounded-xl py-3 items-center`}>
                        <Text style={tw`text-gray-300 font-bold`}>Ganti Akun</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}
