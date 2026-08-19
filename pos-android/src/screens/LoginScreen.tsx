import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import bcrypt from 'bcryptjs';
import tw, { useAppColorScheme } from 'twrnc';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { getDBConnection } from '../database/db';
import api from '../services/api';
import {
    clearAuthSession,
    loadAuthSession,
    migrateLegacyAuthStorage,
    saveAuthSession,
} from '../services/secureAuthStorage';
import { licenseToSettings, resolveLicenseStatus } from '../services/licenseService';

export default function LoginScreen({ navigation }: any) {
    useAppColorScheme(tw);
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isAutoLogging, setIsAutoLogging] = useState(true);
    const [rememberMe, setRememberMe] = useState(true);
    const setUser = useStore((state) => state.setUser);
    const setSettings = useStore((state) => state.setSettings);

    const continueAfterLicenseCheck = async () => {
        const license = await resolveLicenseStatus();
        setSettings({ ...useStore.getState().settings, ...licenseToSettings(license) });
        navigation.replace(license.isActive ? 'Main' : 'Lock');
    };

    useEffect(() => {
        const tryAutoLogin = async () => {
            try {
                await migrateLegacyAuthStorage();
                const session = await loadAuthSession();
                if (!session) return;

                if (session.offline) {
                    setUser(session.user);
                    await continueAfterLicenseCheck();
                    return;
                }

                try {
                    const response = await api.get('/auth/me');
                    if (response.data?.success && response.data?.user) {
                        const freshUser = response.data.user;
                        await AsyncStorage.setItem('@auth_user', JSON.stringify(freshUser));
                        setUser(freshUser);
                        await continueAfterLicenseCheck();
                        return;
                    }
                } catch (error: any) {
                    if (error?.response?.status === 401 || error?.response?.status === 403) {
                        await clearAuthSession();
                        return;
                    }

                    // Mode offline tetap dapat bekerja dengan sesi terenkripsi yang
                    // sebelumnya sudah tervalidasi di perangkat ini.
                    setUser(session.user);
                    await continueAfterLicenseCheck();
                }
            } catch (error) {
                console.error('Auto-login error:', error);
                await clearAuthSession();
            } finally {
                setIsAutoLogging(false);
            }
        };
        tryAutoLogin();
    }, [navigation, setUser]);

    const handleLogin = async () => {
        const normalizedIdentifier = identifier.trim().toLowerCase();
        if (!normalizedIdentifier || !password) {
            Alert.alert('Error', 'Email/username dan password harus diisi.');
            return;
        }
        const identifierIsValid = normalizedIdentifier.includes('@')
            ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedIdentifier)
            : /^[a-z0-9][a-z0-9._-]{2,49}$/.test(normalizedIdentifier);
        if (!identifierIsValid) {
            Alert.alert('Validasi Gagal', 'Masukkan email atau username yang valid.');
            return;
        }
        if (password.length < 6) {
            Alert.alert('Validasi Gagal', 'Password minimal 6 karakter.');
            return;
        }

        setIsLoading(true);
        try {
            const response = await api.post('/auth/login', {
                identifier: normalizedIdentifier,
                email: normalizedIdentifier,
                password,
                clientType: 'ANDROID',
                deviceName: `Android ${String(Platform.Version)}`,
            });

            if (response.data?.success) {
                const { token, user } = response.data;
                if (user?.mustChangePassword) {
                    try {
                        await api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` } });
                    } catch { /* sesi tetap akan kedaluwarsa di server */ }
                    await clearAuthSession();
                    Alert.alert(
                        'Ganti Password Diperlukan',
                        'Masuk ke website LitePOS dan buat password baru terlebih dahulu, lalu login kembali di Android.'
                    );
                    return;
                }

                await saveAuthSession({ token, user, remember: rememberMe });
                setUser(user);

                try {
                    const passwordHash = await bcrypt.hash(password, 10);
                    const db = await getDBConnection();
                    await db.executeSql(
                        'INSERT OR REPLACE INTO users (id, name, email, username, pin, role) VALUES (?, ?, ?, ?, ?, ?)',
                        [user.id, user.name, user.email, user.username || null, passwordHash, user.role]
                    );
                } catch (cacheError) {
                    console.error('Gagal menyimpan kredensial offline:', cacheError);
                }

                await continueAfterLicenseCheck();
            }
        } catch (error: any) {
            if (error?.response && error.response.status >= 400 && error.response.status < 500) {
                Alert.alert('Login Gagal', error.response?.data?.message || 'Email/username atau password salah.');
                return;
            }

            try {
                const db = await getDBConnection();
                const [results] = await db.executeSql(
                    'SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1',
                    [normalizedIdentifier, normalizedIdentifier]
                );
                if (results.rows.length === 0) throw new Error('USER_NOT_FOUND');

                const localUser = results.rows.item(0);
                const storedHash = typeof localUser.pin === 'string' ? localUser.pin : '';
                const matches = storedHash.startsWith('$2') && await bcrypt.compare(password, storedHash);
                if (!matches) throw new Error('INVALID_PASSWORD');

                const offlineUser = {
                    id: localUser.id,
                    name: localUser.name,
                    email: localUser.email,
                    username: localUser.username,
                    role: localUser.role,
                };
                await saveAuthSession({ user: offlineUser, offline: true, remember: rememberMe });
                setUser(offlineUser);
                Alert.alert('Mode Offline', 'Login memakai data terenkripsi yang pernah diverifikasi di HP ini.');
                await continueAfterLicenseCheck();
            } catch {
                Alert.alert('Login Gagal', 'Server tidak dapat dihubungi dan kredensial offline tidak cocok.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (isAutoLogging) {
        return (
            <SafeAreaView style={tw`flex-1 justify-center items-center bg-gray-100 dark:bg-gray-800`}>
                <Image source={require('../assets/logo.png')} style={tw`w-24 h-24 mb-6`} resizeMode="contain" />
                <ActivityIndicator size="large" color={tw.color('blue-600')} />
                <Text style={tw`text-gray-500 dark:text-gray-400 mt-4 font-bold text-sm`}>Memuat sesi...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={tw`flex-1 justify-center items-center bg-gray-100 dark:bg-gray-800 p-6`}>
            <View style={tw`items-center mb-8`}>
                <Image source={require('../assets/logo.png')} style={tw`w-24 h-24 mb-4`} resizeMode="contain" />
                <Text style={tw`text-4xl font-black text-center text-gray-900 dark:text-white tracking-tight`}>LitePOS</Text>
                <Text style={tw`text-sm font-bold text-center text-gray-500 dark:text-gray-400 mt-1`}>Sistem Point of Sale</Text>
            </View>

            <View style={tw`bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-md w-full max-w-sm border border-gray-100 dark:border-gray-800`}>
                <Text style={tw`text-lg text-center text-gray-700 dark:text-gray-200 font-bold mb-6`}>Login POS</Text>
                <TextInput
                    style={tw`bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 mb-4 text-center text-lg font-bold text-gray-900 dark:text-white shadow-sm`}
                    value={identifier}
                    onChangeText={setIdentifier}
                    keyboardType="default"
                    autoCapitalize="none"
                    placeholder="Email atau username"
                    placeholderTextColor="#9ca3af"
                />
                <TextInput
                    style={tw`bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 mb-4 text-center text-xl font-black tracking-[8px] text-gray-900 dark:text-white shadow-sm`}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="Password"
                    placeholderTextColor="#9ca3af"
                />
                <TouchableOpacity style={tw`flex-row items-center mb-6 self-start pl-2`} onPress={() => setRememberMe(!rememberMe)}>
                    <Icon name={rememberMe ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={tw.color(rememberMe ? 'blue-600' : 'gray-400')} />
                    <Text style={tw`ml-2 text-sm text-gray-600 dark:text-gray-300 font-bold`}>Ingat Saya</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={tw`bg-blue-600 rounded-xl py-3 items-center ${isLoading ? 'opacity-70' : ''}`}
                    onPress={handleLogin}
                    disabled={isLoading}
                >
                    <Text style={tw`text-white font-bold text-lg`}>{isLoading ? 'Loading...' : 'Masuk'}</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
