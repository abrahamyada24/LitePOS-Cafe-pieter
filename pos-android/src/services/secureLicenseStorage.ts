import * as Keychain from 'react-native-keychain';

const LICENSE_CACHE_SERVICE = 'com.litepos.license.cache';

export type LicenseStatus = {
    licenseNumber: string | null;
    plan: 'TRIAL' | 'PREMIUM' | 'UNKNOWN';
    status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'UNKNOWN';
    isActive: boolean;
    startsAt?: string | null;
    expiresAt: string | null;
    activatedAt?: string | null;
    activationSource?: string | null;
    offlineGraceDays: number;
    daysRemaining: number | null;
    serverTime: string;
    cachedAt?: string;
    offline?: boolean;
};

export const cacheLicenseStatus = async (license: LicenseStatus) => {
    const payload = JSON.stringify({ ...license, cachedAt: new Date().toISOString() });
    await Keychain.setGenericPassword('litepos-license', payload, {
        service: LICENSE_CACHE_SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
};

export const clearLicenseCache = async () => {
    await Keychain.resetGenericPassword({ service: LICENSE_CACHE_SERVICE });
};

export const getCachedLicenseStatus = async (): Promise<LicenseStatus | null> => {
    const credentials = await Keychain.getGenericPassword({ service: LICENSE_CACHE_SERVICE });
    if (!credentials) return null;
    try {
        const license = JSON.parse(credentials.password) as LicenseStatus;
        const now = Date.now();
        const cachedAt = new Date(license.cachedAt || '').getTime();
        const serverTime = new Date(license.serverTime || '').getTime();
        const graceMs = Math.max(0, Number(license.offlineGraceDays || 0)) * 24 * 60 * 60 * 1000;
        const expiresAt = license.expiresAt ? new Date(license.expiresAt).getTime() : null;
        const clockRolledBack = Number.isFinite(serverTime) && now + 5 * 60 * 1000 < serverTime;
        const graceExpired = !Number.isFinite(cachedAt) || now - cachedAt > graceMs;
        const licenseExpired = expiresAt !== null && (!Number.isFinite(expiresAt) || now >= expiresAt);

        if (!license.isActive || clockRolledBack || graceExpired || licenseExpired) {
            return {
                ...license,
                status: license.status === 'SUSPENDED'
                    ? 'SUSPENDED'
                    : license.status === 'UNKNOWN' ? 'UNKNOWN' : 'EXPIRED',
                isActive: false,
                offline: true,
            };
        }
        return { ...license, offline: true };
    } catch {
        await clearLicenseCache();
        return null;
    }
};
