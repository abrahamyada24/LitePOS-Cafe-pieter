type ReceiptBrandingSettings = {
    license_type?: string | null;
    license_status?: string | null;
    license_expire_date?: string | null;
};

export const hasActivePremiumLicense = (
    settings: ReceiptBrandingSettings,
    now = Date.now(),
) => {
    if (String(settings.license_type || '').toUpperCase() !== 'PREMIUM') {
        return false;
    }

    const status = String(settings.license_status || '').toUpperCase();
    if (status && status !== 'ACTIVE') {
        return false;
    }

    const expiresAt = Date.parse(String(settings.license_expire_date || ''));
    return Number.isFinite(expiresAt) && expiresAt > now;
};

export const shouldShowLitePosBranding = (
    settings: ReceiptBrandingSettings,
    now = Date.now(),
) => !hasActivePremiumLicense(settings, now);
