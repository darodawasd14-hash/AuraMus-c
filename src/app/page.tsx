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
    // If there's a user, they should be in the main app view.
    // If they land on a profile page, the /[...slug] structure will handle it.
  }, [user, router]);


  if (isUserLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <AuraApp />;
}
