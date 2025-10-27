import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { PlayerProvider } from '@/context/player-context';
import { FirebaseClientProvider } from '@/firebase/client-provider';

export const metadata: Metadata = {
  title: 'Aura',
  description: 'Your personal music sanctuary.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" rel="stylesheet" />
        <script src="https://www.youtube.com/iframe_api" async></script>
        <script src="https://w.soundcloud.com/player/api.js" async></script>
      </head>
      <body className={cn("h-full antialiased")} suppressHydrationWarning>
        <FirebaseClientProvider>
          <PlayerProvider>
            {children}
            <Toaster />
          </PlayerProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
