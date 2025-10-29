import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Player } from '@/components/player'; 
import { PlayerProvider } from '@/context/player-context';

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
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className={cn("h-full antialiased")} suppressHydrationWarning>
        <FirebaseClientProvider>
          <PlayerProvider>
            {/* The Player component is now here, invisible. It provides sound for the whole app. */}
            <Player /> 
            {children}
            <Toaster />
          </PlayerProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
