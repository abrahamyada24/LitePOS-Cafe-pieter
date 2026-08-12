export const hasActiveLicense = (license) => license?.isActive === true;

export const shouldShowLitePosBranding = (license) => !hasActiveLicense(license);
