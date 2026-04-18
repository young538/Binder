import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '3P 바인더',
    short_name: '3P',
    description: '시간 기반 개인 플래너 — 목표에서 일일 실행까지',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1a73e8',
    icons: [
      { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
  };
}
