import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// URL Backend - Lokal (10.0.2.2 adalah IP untuk Android Emulator mengakses localhost PC)
// Jika menggunakan Device fisik (HP), ganti dengan IP IPv4 laptop Anda (contoh: http://192.168.1.10:5000)
export const API_URL = 'http://103.175.221.2:5000'; 

const api = axios.create({
    baseURL: `${API_URL}/api`,
    timeout: 10000, // 10 detik timeout
    headers: {
        'Content-Type': 'application/json',
    }
});

// Interceptor untuk menyisipkan token JWT ke setiap request
api.interceptors.request.use(
    async (config) => {
        try {
            const token = await AsyncStorage.getItem('@auth_token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (error) {
            console.error('Gagal mengambil token:', error);
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;
