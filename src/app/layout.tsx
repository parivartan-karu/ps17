import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { PWARegister } from '@/components/pwa-register';
import { OfflineIndicator } from '@/components/offline-indicator';
import { PushNotificationPrompt } from '@/components/push-notification-prompt';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Parivartan | Pune Municipal Corporation',
  description: 'Smart Road Damage Reporting & Rapid Response System for Pune Municipal Corporation.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Parivartan',
  },
  applicationName: 'Parivartan',
  icons: [
    { rel: 'icon', url: '/logo.png', type: 'image/png' },
    { rel: 'icon', url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    { rel: 'apple-touch-icon', url: '/icons/icon-192x192.png' },
  ],
};

export const viewport: Viewport = {
  themeColor: '#f8fafc',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="icon" href="/icons/icon-192x192.png" type="image/png" sizes="192x192" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.variable} bg-slate-50 text-slate-900 antialiased`}>
        <PWARegister />
        <FirebaseClientProvider>
          <OfflineIndicator />
          <PushNotificationPrompt />
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
