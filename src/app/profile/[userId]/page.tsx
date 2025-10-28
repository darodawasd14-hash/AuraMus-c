'use client';
import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus, UserMinus, ArrowLeft, Music } from 'lucide-react';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

// Define types used in the component
type UserProfile = {
  displayName: string | null;
  email: string | null;
};

type Playlist = {
  id: string;
  name: string;
  songCount: number; // Add a song count for display
};

export default function ProfilePage() {
  const router = useRouter();
  const params = useParams();
  const profileUserId = params.userId as string;

  const { user: currentUser } = useUser();
  const firestore = useFirestore();

  // Memoize Firestore references
  const profileUserRef = useMemoFirebase(() => firestore ? doc(firestore, 'users', profileUserId) : null, [firestore, profileUserId]);
  const followersRef = useMemoFirebase(() => firestore ? collection(firestore, 'users', profileUserId, 'followers') : null, [firestore, profileUserId]);
  const followingRef = useMemoFirebase(() => firestore ? collection(firestore, 'users', profileUserId, 'following') : null, [firestore, profileUserId]);
  const playlistsRef = useMemoFirebase(() => firestore ? collection(firestore, 'users', profileUserId, 'playlists') : null, [firestore, profileUserId]);

  // Fetch data using hooks
  const { data: profileUser, isLoading: isProfileLoading } = useDoc<UserProfile>(profileUserRef);
  const { data: followers, isLoading: isFollowersLoading } = useCollection(followersRef);
  const { data: following, isLoading: isFollowingLoading } = useCollection(followingRef);
  const { data: playlists, isLoading: isPlaylistsLoading } = useCollection<Playlist>(playlistsRef);

  const isFollowing = useMemo(() => followers?.some(f => f.id === currentUser?.uid), [followers, currentUser]);
  const isLoading = isProfileLoading || isFollowersLoading || isFollowingLoading || isPlaylistsLoading;

  const handleFollow = async () => {
    if (!currentUser || !firestore) return;
    const followerRef = doc(firestore, 'users', profileUserId, 'followers', currentUser.uid);
    const followingRef = doc(firestore, 'users', currentUser.uid, 'following', profileUserId);
    
    await setDoc(followerRef, { uid: currentUser.uid });
    await setDoc(followingRef, { uid: profileUserId });
  };

  const handleUnfollow = async () => {
    if (!currentUser || !firestore) return;
    const followerRef = doc(firestore, 'users', profileUserId, 'followers', currentUser.uid);
    const followingRef = doc(firestore, 'users', currentUser.uid, 'following', profileUserId);
    
    await deleteDoc(followerRef);
    await deleteDoc(followingRef);
  };

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
        <Button onClick={() => router.push('/')} variant="outline">Ana Sayfaya Dön</Button>
      </div>
    );
  }

  const displayName = profileUser.displayName || 'İsimsiz Kullanıcı';
  const displayEmail = profileUser.email || 'E-posta yok';
  const fallbackAvatar = displayName.charAt(0).toUpperCase() || 'U';


  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto p-4 md:p-8">
        <Button onClick={() => router.back()} variant="ghost" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Geri
        </Button>

        {/* Profile Header */}
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

        {/* Playlists Section */}
        <main className="mt-8">
          <h2 className="mb-4 text-2xl font-semibold">Herkese Açık Çalma Listeleri</h2>
          {playlists && playlists.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {playlists.map(playlist => (
                <Card key={playlist.id} className="overflow-hidden transition-shadow hover:shadow-lg">
                  <Link href={`/playlist/${profileUserId}/${playlist.id}`}>
                    <div className="flex cursor-pointer flex-col">
                      <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                        <Music className="h-12 w-12 text-muted-foreground" />
                      </div>
                      <div className="p-4">
                        <p className="font-semibold truncate">{playlist.name}</p>
                        {/* <p className="text-sm text-muted-foreground">{playlist.songCount ?? 0} şarkı</p> */}
                      </div>
                    </div>
                  </Link>
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
