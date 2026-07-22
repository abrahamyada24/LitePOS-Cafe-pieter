/** @type {import('next').NextConfig} */
const rawBackendUrl = process.env.API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const backendUrl = rawBackendUrl.replace(/\/api\/?$/i, '').replace(/\/+$/, '');
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com https://ik.imagekit.io https://o-cdf.oramiland.com https://image.idntimes.com",
  "font-src 'self' data:",
  "connect-src 'self' https://103.150.227.178",
  "upgrade-insecure-requests",
].join('; ');

const backendImagePattern = (() => {
  try {
    const url = new URL(backendUrl);
    return {
      protocol: url.protocol.replace(':', ''),
      hostname: url.hostname,
      port: url.port,
      pathname: '/uploads/**',
    };
  } catch {
    return null;
  }
})();

const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`
      },
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`
      }
    ]
  },
  images: {
    remotePatterns: [
      ...(backendImagePattern ? [backendImagePattern] : []),
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ik.imagekit.io', // Jika ada image dari sini juga (seperti di data mock restoran)
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'o-cdf.oramiland.com', // Untuk image ayam bakar tadi
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'image.idntimes.com', // Untuk image kentang goreng
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
