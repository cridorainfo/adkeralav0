import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'adkerala Driver',
  description: 'Bus driver control panel',
  manifest: '/manifest.json',
  themeColor: '#006B3C',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'adkerala' },
  other: { 'mobile-web-app-capable': 'yes' },
};

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="driver-shell">
      {children}
    </div>
  );
}
