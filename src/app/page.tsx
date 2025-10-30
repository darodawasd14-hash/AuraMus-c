'use client';

import { useUser } from '@/firebase';
import AuthPage from '@/app/auth/page';
import { AuraApp } from '@/components/aura-app';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, isUserLoading } = useUser();

  if (isUserLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If there's no user, show the authentication page.
  if (!user) {
    return <AuthPage />;
  }
  
  // If the user is logged in, show the main app directly.
  return <AuraApp />;
}
