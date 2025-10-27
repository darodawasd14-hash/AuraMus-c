'use client';

import { useUser } from '@/firebase';
import AuthPage from '@/app/auth/page';
import { AuraApp } from '@/components/aura-app';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, isUserLoading } = useUser();

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
