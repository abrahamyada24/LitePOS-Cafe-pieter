import api from './api';
import { getDBConnection } from '../database/db';
import {
    LicenseStatus,
    cacheLicenseStatus,
    getCachedLicenseStatus,
} from './secureLicenseStorage';

const unknownLicense = (): LicenseStatus => ({
    licenseNumber: null,
    plan: 'UNKNOWN',
    status: 'UNKNOWN',
    isActive: false,
    expiresAt: null,
    offlineGraceDays: 7,
    daysRemaining: null,
    serverTime: new Date().toISOString(),
    offline: true,
});

export const licenseToSettings = (license: LicenseStatus) => ({
    license_number: license.licenseNumber || '',
    license_status: license.status,
    license_type: license.plan === 'UNKNOWN' ? 'TRIAL' : license.plan,
    license_expire_date: license.expiresAt || '',
    license_offline: Boolean(license.offline),
});

export const persistLicenseStatus = async (license: LicenseStatus) => {
    const db = await getDBConnection();
    const settings = licenseToSettings(license);
    for (const [key, value] of Object.entries(settings)) {
        await db.executeSql(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            [key, String(value)]
        );
    }
};

export const fetchLicenseStatus = async (): Promise<LicenseStatus> => {
    const response = await api.get('/license/status');
    if (!response.data?.success || !response.data?.data) throw new Error('Status lisensi tidak tersedia.');
    const license = response.data.data as LicenseStatus;
    await cacheLicenseStatus(license);
    await persistLicenseStatus(license);
    return { ...license, offline: false };
};

export const resolveLicenseStatus = async (): Promise<LicenseStatus> => {
    try {
        return await fetchLicenseStatus();
    } catch {
        const cached = await getCachedLicenseStatus();
        const license = cached || unknownLicense();
        await persistLicenseStatus(license);
        return license;
    }
};

export const activateLicense = async (code: string): Promise<LicenseStatus> => {
    const response = await api.post('/license/activate', { code });
    if (!response.data?.success || !response.data?.data) {
        throw new Error(response.data?.message || 'Aktivasi lisensi gagal.');
    }
    const license = response.data.data as LicenseStatus;
    await cacheLicenseStatus(license);
    await persistLicenseStatus(license);
    return { ...license, offline: false };
};
