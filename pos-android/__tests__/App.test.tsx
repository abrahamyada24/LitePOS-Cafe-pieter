/**
 * @format
 */

import {
  buildApiBaseUrl,
  DEFAULT_API_URL,
  normalizeApiBaseUrl,
} from '../src/services/api';

describe('konfigurasi backend Android', () => {
  test('menggunakan backend produksi yang sama dengan website', () => {
    expect(DEFAULT_API_URL).toBe('https://103.150.227.178');
    expect(buildApiBaseUrl(DEFAULT_API_URL)).toBe('https://103.150.227.178/api');
  });

  test('memigrasikan alamat backend Android lama', () => {
    expect(normalizeApiBaseUrl('http://103.175.221.2:5000')).toBe(DEFAULT_API_URL);
  });

  test('menormalkan URL custom tanpa menggandakan suffix api', () => {
    expect(normalizeApiBaseUrl('https://pos.example.com/api/')).toBe('https://pos.example.com');
  });
});
