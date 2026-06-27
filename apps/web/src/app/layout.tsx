import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'adkerala', template: '%s | adkerala' },
  description: 'Smart bus display and passenger information network for Kerala',
  manifest: '/manifest.json',
  themeColor: '#006B3C',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ml">
      <head>
        {/* Noto Sans Malayalam for Malayalam text rendering */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Malayalam:wght@400;600;700&family=Noto+Serif+Malayalam:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
