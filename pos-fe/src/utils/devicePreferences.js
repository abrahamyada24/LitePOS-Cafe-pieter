export const DEVICE_PREFERENCES_KEY = 'litepos_device_preferences';

export const DEFAULT_DEVICE_PREFERENCES = Object.freeze({
  theme: 'light',
  paperWidth: '58',
  printMarginMm: 3,
});

const normalizeTheme = (value) => (
  ['light', 'dark', 'system'].includes(value) ? value : DEFAULT_DEVICE_PREFERENCES.theme
);

const normalizePaperWidth = (value) => (
  String(value) === '80' ? '80' : DEFAULT_DEVICE_PREFERENCES.paperWidth
);

const normalizePrintMargin = (value) => {
  const numericValue = Number(value);
  return [0, 2, 3, 5].includes(numericValue)
    ? numericValue
    : DEFAULT_DEVICE_PREFERENCES.printMarginMm;
};

export const normalizeDevicePreferences = (value = {}) => ({
  theme: normalizeTheme(value.theme),
  paperWidth: normalizePaperWidth(value.paperWidth),
  printMarginMm: normalizePrintMargin(value.printMarginMm),
});

export const getDevicePreferences = () => {
  if (typeof window === 'undefined') return { ...DEFAULT_DEVICE_PREFERENCES };

  try {
    const savedValue = JSON.parse(window.localStorage.getItem(DEVICE_PREFERENCES_KEY) || '{}');
    return normalizeDevicePreferences(savedValue);
  } catch (_) {
    return { ...DEFAULT_DEVICE_PREFERENCES };
  }
};

export const applyWebTheme = (theme) => {
  if (typeof window === 'undefined') return;

  const normalizedTheme = normalizeTheme(theme);
  const resolvedTheme = normalizedTheme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : normalizedTheme;

  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
};

export const saveDevicePreferences = (nextValue) => {
  if (typeof window === 'undefined') return normalizeDevicePreferences(nextValue);

  const preferences = normalizeDevicePreferences({
    ...getDevicePreferences(),
    ...nextValue,
  });
  window.localStorage.setItem(DEVICE_PREFERENCES_KEY, JSON.stringify(preferences));
  applyWebTheme(preferences.theme);
  window.dispatchEvent(new CustomEvent('litepos-device-preferences', { detail: preferences }));
  return preferences;
};

export const getPaperWidthMm = (preferences) => (
  normalizePaperWidth(preferences?.paperWidth) === '80' ? 80 : 58
);
