'use client';
import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, collection, setDoc, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus, UserMinus, ArrowLeft, Music, Home } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { AuraApp } from '@/components/aura-app';

type UserProfile = {
  displayName: string | null;
  email: string | null;
};

type Playlist = {
  id: string;
  name: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const params = useParams();
  const profileUserId = params.userId as string;

  const { user: currentUser } = useUser();
  const firestore = useFirestore();

  const profileUserRef = useMemoFirebase(() => firestore ? doc(firestore, 'users', profileUserId) : null, [firestore, profileUserId]);
  const followersRef = useMemoFirebase(() => firestore ? collection(firestore, 'users', profileUserId, 'followers') : null, [firestore, profileUserId]);
  const followingRef = useMemoFirebase(() => firestore ? collection(firestore, 'users', profileUserId, 'following') : null, [firestore, profileUserId]);
  const playlistsRef = useMemoFirebase(() => firestore ? collection(firestore, 'users', profileUserId, 'playlists') : null, [firestore, profileUserId]);

  const { data: profileUser, isLoading: isProfileLoading } = useDoc<UserProfile>(profileUserRef);
  const { data: followers, isLoading: isFollowersLoading } = useCollection(followersRef);
  const { data: following, isLoading: isFollowingLoading } = useCollection(followingRef);
  const { data: playlists, isLoading: isPlaylistsLoading } = useCollection<Playlist>(playlistsRef);

  const isFollowing = useMemo(() => followers?.some(f => f.id === currentUser?.uid), [followers, currentUser]);
  const isLoading = isProfileLoading || isFollowersLoading || isFollowingLoading || isPlaylistsLoading;

  const handleFollow = () => {
    if (!currentUser || !firestore) return;
    const followerData = { uid: currentUser.uid };
    const followerRef = doc(firestore, 'users', profileUserId, 'followers', currentUser.uid);
    setDoc(followerRef, followerData).catch(serverError => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: followerRef.path,
            operation: 'create',
            requestResourceData: followerData,
        }));
    });
    
    const followingData = { uid: profileUserId };
    const followingRefDoc = doc(firestore, 'users', currentUser.uid, 'following', profileUserId);
    setDoc(followingRefDoc, followingData).catch(serverError => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: followingRefDoc.path,
            operation: 'create',
            requestResourceData: followingData,
        }));
    });
  };

  const handleUnfollow = () => {
    if (!currentUser || !firestore) return;
    const followerRef = doc(firestore, 'users', profileUserId, 'followers', currentUser.uid);
    deleteDoc(followerRef).catch(serverError => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: followerRef.path,
            operation: 'delete',
        }));
    });
    
    const followingRefDoc = doc(firestore, 'users', currentUser.uid, 'following', profileUserId);
    deleteDoc(followingRefDoc).catch(serverError => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: followingRefDoc.path,
            operation: 'delete',
        }));
    });
  };
  
  // If the user is viewing their own profile, show the main Aura app.
  if (currentUser && currentUser.uid === profileUserId) {
    return <AuraApp />;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
        <p>Kullanıcı bulunamadı.</p>
        <Button onClick={() => router.push('/')} variant="outline">
           <Home className="mr-2 h-4 w-4" /> Ana Sayfaya Dön
        </Button>
      </div>
    );
  }

  const displayName = profileUser.displayName || 'İsimsiz Kullanıcı';
  const displayEmail = profileUser.email || 'E-posta yok';
  const fallbackAvatar = displayName.charAt(0).toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto p-4 md:p-8">
        <Button onClick={() => router.push('/')} variant="ghost" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Ana Sayfa
        </Button>

        <header className="flex flex-col items-center gap-6 rounded-lg border border-border bg-secondary/50 p-8 text-center md:flex-row md:text-left">
          <Avatar className="h-24 w-24 border-4 border-primary">
            <AvatarImage src={`https://api.dicebear.com/8.x/bottts/svg?seed=${profileUserId}`} alt={displayName} />
            <AvatarFallback>{fallbackAvatar}</AvatarFallback>
          </Avatar>
          <div className="flex-grow">
            <h1 className="text-4xl font-bold tracking-tight">{displayName}</h1>
            <p className="text-muted-foreground">{displayEmail}</p>
            <div className="mt-4 flex justify-center gap-6 md:justify-start">
              <div>
                <p className="text-2xl font-bold">{followers?.length ?? 0}</p>
                <p className="text-sm text-muted-foreground">Takipçi</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{following?.length ?? 0}</p>
                <p className="text-sm text-muted-foreground">Takip Edilen</p>
              </div>
            </div>
          </div>
          {currentUser && currentUser.uid !== profileUserId && (
            <div className="mt-4 md:mt-0">
              {isFollowing ? (
                <Button onClick={handleUnfollow} variant="outline">
                  <UserMinus className="mr-2 h-4 w-4" /> Takipten Çık
                </Button>
              ) : (
                <Button onClick={handleFollow}>
                  <UserPlus className="mr-2 h-4 w-4" /> Takip Et
                </Button>
              )}
            </div>
          )}
        </header>

        <main className="mt-8">
          <h2 className="mb-4 text-2xl font-semibold">Herkese Açık Çalma Listeleri</h2>
          {playlists && playlists.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {playlists.map(playlist => (
                <Card key={playlist.id} className="overflow-hidden transition-shadow hover:shadow-lg">
                   <div className="flex cursor-default flex-col">
                      <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                        <Music className="h-12 w-12 text-muted-foreground" />
                      </div>
                      <div className="p-4">
                        <p className="font-semibold truncate">{playlist.name}</p>
                      </div>
                    </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 text-center">
              <Music className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="font-semibold">Henüz çalma listesi yok</p>
              <p className="text-sm text-muted-foreground">Bu kullanıcının herkese açık çalma listesi bulunmuyor.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
