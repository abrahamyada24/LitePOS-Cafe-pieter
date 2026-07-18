import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_API_URL = 'https://103.150.227.178';
export const API_BASE_URL_STORAGE_KEY = '@litepos_api_base_url';
export const API_URL = DEFAULT_API_URL;

const LEGACY_API_URLS = new Set([
    'http://103.175.221.2:5000',
]);

const stripApiSuffix = (url: string) => url.replace(/\/api\/?$/i, '');

export const normalizeApiBaseUrl = (value?: string | null) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return DEFAULT_API_URL;

    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    const normalized = stripApiSuffix(withProtocol).replace(/\/+$/, '');
    return LEGACY_API_URLS.has(normalized) ? DEFAULT_API_URL : normalized;
};

export const buildApiBaseUrl = (baseUrl: string) => `${normalizeApiBaseUrl(baseUrl)}/api`;

export const isDeviceAssetUrl = (value?: string | null) => {
    if (!value) return false;
    return /^(file|content|ph|assets-library):\/\//i.test(value);
};

export const resolveApiAssetUrl = (value?: string | null, baseUrl?: string | null) => {
    const assetUrl = (value || '').trim();
    if (!assetUrl) return null;

    if (/^(https?:|data:|file:|content:|ph:|assets-library:)/i.test(assetUrl)) {
        return assetUrl;
    }

    const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl);
    return `${normalizedBaseUrl}/${assetUrl.replace(/^\/+/, '')}`;
};

export const getApiBaseUrl = async () => {
    const savedUrl = await AsyncStorage.getItem(API_BASE_URL_STORAGE_KEY);
    const normalized = normalizeApiBaseUrl(savedUrl);

    if (savedUrl && LEGACY_API_URLS.has(stripApiSuffix(savedUrl.trim()).replace(/\/+$/, ''))) {
        await AsyncStorage.setItem(API_BASE_URL_STORAGE_KEY, normalized);
        await AsyncStorage.multiRemove(['@auth_token', '@auth_user']);
    }

    return normalized;
};

const api = axios.create({
    baseURL: buildApiBaseUrl(DEFAULT_API_URL),
    timeout: 10000, // 10 detik timeout
    headers: {
        'Content-Type': 'application/json',
    }
});

export const setApiBaseUrl = async (value: string) => {
    const normalized = normalizeApiBaseUrl(value);
    const previous = normalizeApiBaseUrl(await AsyncStorage.getItem(API_BASE_URL_STORAGE_KEY));

    // JWT hanya valid untuk backend yang menerbitkannya. Saat server diganti,
    // buang sesi online lama agar token tidak terkirim ke instalasi lain.
    if (previous !== normalized) {
        const token = await AsyncStorage.getItem('@auth_token');
        if (token && token !== 'offline-mode-token') {
            await AsyncStorage.multiRemove(['@auth_token', '@auth_user']);
        }
    }

    await AsyncStorage.setItem(API_BASE_URL_STORAGE_KEY, normalized);
    api.defaults.baseURL = buildApiBaseUrl(normalized);
    return normalized;
};

export const hydrateApiBaseUrl = async () => {
    const normalized = await getApiBaseUrl();
    api.defaults.baseURL = buildApiBaseUrl(normalized);
    return normalized;
};

// Interceptor untuk menyisipkan token JWT ke setiap request
api.interceptors.request.use(
    async (config) => {
        try {
            const baseUrl = await getApiBaseUrl();
            config.baseURL = buildApiBaseUrl(baseUrl);

            const token = await AsyncStorage.getItem('@auth_token');
            if (token && token !== 'offline-mode-token') {
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
