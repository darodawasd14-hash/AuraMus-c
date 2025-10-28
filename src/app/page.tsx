'use client';

import { useUser } from '@/firebase';
import AuthPage from '@/app/auth/page';
import { AuraApp } from '@/components/aura-app';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    // If there's a user and we are on the root page, redirect to their profile.
    if (user && !isUserLoading) {
      router.push(`/profile/${user.uid}`);
    }
  }, [user, isUserLoading, router]);

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
  
  // This part will be shown briefly while redirecting, or if the redirect fails.
  // We can show a loader here as well.
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}
