import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

const AUTH_TOKEN_SERVICE = 'com.litepos.auth.token';
const AUTH_USER_KEY = '@auth_user';
const AUTH_OFFLINE_KEY = '@auth_offline_session';
const AUTH_REMEMBER_KEY = '@auth_remember_me';
const AUTH_LAST_ACTIVITY_KEY = '@auth_last_activity';
const LEGACY_AUTH_TOKEN_KEY = '@auth_token';

export const AUTH_INACTIVITY_TIMEOUT_HOURS = 16;
export const AUTH_INACTIVITY_TIMEOUT_MS = AUTH_INACTIVITY_TIMEOUT_HOURS * 60 * 60 * 1000;
export const OFFLINE_SESSION_TOKEN = 'offline-session';

export const setAuthToken = async (token: string) => {
    await Keychain.setGenericPassword('litepos', token, {
        service: AUTH_TOKEN_SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
};

export const getAuthToken = async () => {
    const credentials = await Keychain.getGenericPassword({ service: AUTH_TOKEN_SERVICE });
    return credentials ? credentials.password : null;
};

export const clearAuthSession = async () => {
    await Promise.all([
        Keychain.resetGenericPassword({ service: AUTH_TOKEN_SERVICE }),
        AsyncStorage.multiRemove([
            AUTH_USER_KEY,
            AUTH_OFFLINE_KEY,
            AUTH_REMEMBER_KEY,
            AUTH_LAST_ACTIVITY_KEY,
            LEGACY_AUTH_TOKEN_KEY,
        ]),
    ]);
};

export const markAuthActivity = async (at = Date.now()) => {
    await AsyncStorage.setItem(AUTH_LAST_ACTIVITY_KEY, String(at));
};

export const getLastAuthActivity = async () => {
    const value = await AsyncStorage.getItem(AUTH_LAST_ACTIVITY_KEY);
    const timestamp = Number(value);
    return Number.isFinite(timestamp) ? timestamp : null;
};

export const isAuthSessionIdle = async (now = Date.now()) => {
    const lastActivity = await getLastAuthActivity();
    return !lastActivity || now - lastActivity >= AUTH_INACTIVITY_TIMEOUT_MS;
};

export const saveAuthSession = async ({
    token,
    user,
    offline = false,
    remember = true,
}: {
    token?: string | null;
    user: any;
    offline?: boolean;
    remember?: boolean;
}) => {
    await setAuthToken(offline ? OFFLINE_SESSION_TOKEN : String(token || ''));
    await AsyncStorage.multiSet([
        [AUTH_USER_KEY, JSON.stringify(user)],
        [AUTH_OFFLINE_KEY, offline ? 'true' : 'false'],
        [AUTH_REMEMBER_KEY, remember ? 'true' : 'false'],
        [AUTH_LAST_ACTIVITY_KEY, String(Date.now())],
    ]);
    await AsyncStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
};

export const loadAuthSession = async () => {
    const [[, savedUser], [, offlineValue], [, rememberValue]] = await AsyncStorage.multiGet([
        AUTH_USER_KEY,
        AUTH_OFFLINE_KEY,
        AUTH_REMEMBER_KEY,
    ]);
    const token = await getAuthToken();

    if (!token || !savedUser || rememberValue !== 'true' || await isAuthSessionIdle()) {
        await clearAuthSession();
        return null;
    }

    try {
        return {
            token,
            user: JSON.parse(savedUser),
            offline: offlineValue === 'true' || token === OFFLINE_SESSION_TOKEN,
        };
    } catch {
        await clearAuthSession();
        return null;
    }
};

export const migrateLegacyAuthStorage = async () => {
    const legacyToken = await AsyncStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
    if (legacyToken) {
        // Token/PIN lama tidak dipindahkan karena penyimpanannya tidak memenuhi standar baru.
        await clearAuthSession();
    }
};
