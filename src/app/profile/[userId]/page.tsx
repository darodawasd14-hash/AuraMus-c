'use client';
import { useMemo, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase, useAuth } from '@/firebase';
import { doc, collection, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus, UserMinus, ArrowLeft, Music, Home, LogOut, Lock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useToast } from '@/hooks/use-toast';

type UserProfile = {
  displayName: string | null;
  email: string | null;
  arePlaylistsPublic?: boolean;
};

type Playlist = {
  id: string;
  name: string;
  songCount?: number;
};

export default function ProfilePage() {
  const router = useRouter();
  const params = useParams();
  const profileUserId = params.userId as string;

  const { user: currentUser, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  
  const [isFollowingProcessing, setIsFollowingProcessing] = useState(false);

  const profileUserRef = useMemoFirebase(() => (firestore && profileUserId) ? doc(firestore, 'users', profileUserId) : null, [firestore, profileUserId]);
  
  const followersRef = useMemoFirebase(() => (firestore && profileUserId) ? collection(firestore, 'users', profileUserId, 'followers') : null, [firestore, profileUserId]);
  const followingRef = useMemoFirebase(() => (firestore && profileUserId) ? collection(firestore, 'users', profileUserId, 'following') : null, [firestore, profileUserId]);
  const playlistsRef = useMemoFirebase(() => (firestore && profileUserId) ? collection(firestore, 'users', profileUserId, 'playlists') : null, [firestore, profileUserId]);

  const { data: profileUser, isLoading: isProfileLoading } = useDoc<UserProfile>(profileUserRef);
  const { data: followers, isLoading: isFollowersLoading } = useCollection(followersRef);
  const { data: following, isLoading: isFollowingLoading } = useCollection(followingRef);
  const { data: playlists, isLoading: isPlaylistsLoading } = useCollection<Playlist>(playlistsRef);

  const isFollowing = useMemo(() => {
    if (!currentUser || !followers) return false;
    return followers.some(f => f.id === currentUser.uid);
  }, [followers, currentUser]);
  
  const isOwnProfile = currentUser && currentUser.uid === profileUserId;
  const isLoading = isAuthLoading || isProfileLoading || isFollowersLoading || isFollowingLoading || isPlaylistsLoading;

  const arePlaylistsPublic = profileUser?.arePlaylistsPublic ?? true; 
  const canViewPlaylists = isOwnProfile || arePlaylistsPublic;


  useEffect(() => {
    if (!isAuthLoading && !currentUser) {
      // Don't redirect, just let them view public parts
    }
  }, [isAuthLoading, currentUser, router]);

  const handleFollowToggle = async () => {
    if (!currentUser || !firestore) {
        toast({
            variant: "destructive",
            title: "Giriş Yapmalısınız",
            description: "Bir kullanıcıyı takip etmek için önce giriş yapmanız gerekir."
        });
        return;
    };
    
    setIsFollowingProcessing(true);

    const followerRef = doc(firestore, 'users', profileUserId, 'followers', currentUser.uid);
    const followingRefDoc = doc(firestore, 'users', currentUser.uid, 'following', profileUserId);

    try {
        if (isFollowing) {
            await deleteDoc(followerRef);
            await deleteDoc(followingRefDoc);
        } else {
            await setDoc(followerRef, { uid: currentUser.uid });
            await setDoc(followingRefDoc, { uid: profileUserId });
        }
    } catch (error) {
        console.error("Takip işlemi sırasında hata:", error);
        toast({
            variant: "destructive",
            title: "Hata!",
            description: "Takip işlemi sırasında bir sorun oluştu."
        });
    } finally {
        setTimeout(() => setIsFollowingProcessing(false), 500);
    }
  };
  
  const handlePlaylistPrivacyToggle = async (isPublic: boolean) => {
    if (!profileUserRef) return;
    try {
        await updateDoc(profileUserRef, { arePlaylistsPublic: isPublic });
    } catch(error) {
         toast({
            variant: "destructive",
            title: "Hata!",
            description: "Gizlilik ayarı güncellenemedi."
        });
    }
  };

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/'); 
    }
  };

  if (isLoading || isAuthLoading || isFollowingProcessing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!profileUser && !isLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
        <p>Kullanıcı bulunamadı.</p>
        <Button onClick={() => router.push('/')} variant="outline">
           <Home className="mr-2 h-4 w-4" /> Ana Sayfaya Dön
        </Button>
      </div>
    );
  }
  
  if (!profileUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
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
          <div className="flex flex-col items-center md:items-end gap-4">
            {isOwnProfile && (
              <div className="flex items-center space-x-2">
                <Switch 
                  id="playlists-public" 
                  checked={arePlaylistsPublic}
                  onCheckedChange={handlePlaylistPrivacyToggle}
                />
                <Label htmlFor="playlists-public" className="text-muted-foreground">Listelerim Herkese Açık</Label>
              </div>
            )}
            {currentUser && (
              <div className="flex gap-2">
                {isOwnProfile ? (
                  <Button onClick={handleSignOut} variant="outline">
                    <LogOut className="mr-2 h-4 w-4" /> Çıkış Yap
                  </Button>
                ) : (
                  <>
                    <Button onClick={handleFollowToggle} variant={isFollowing ? "outline" : "default"} disabled={isFollowingProcessing}>
                      {isFollowing ? <UserMinus className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
                      {isFollowing ? 'Takipten Çık' : 'Takip Et'}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="mt-8">
          <h2 className="mb-4 text-2xl font-semibold">Çalma Listeleri</h2>
          {canViewPlaylists ? (
            playlists && playlists.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {playlists.map(playlist => (
                  <Card key={playlist.id} className="overflow-hidden transition-shadow hover:shadow-lg">
                    <div className="flex cursor-default flex-col">
                        <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                          <Music className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <div className="p-4">
                          <p className="font-semibold truncate">{playlist.name}</p>
                           <p className="text-sm text-muted-foreground mt-1">{playlist.songCount ?? 0} şarkı</p>
                        </div>
                      </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 text-center">
                <Music className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="font-semibold">Henüz çalma listesi yok</p>
                {isOwnProfile && <p className="text-sm text-muted-foreground">"Çalma Listelerim" sekmesinden yeni bir liste oluştur.</p>}
              </div>
            )
          ) : (
             <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 text-center">
              <Lock className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="font-semibold">Bu Kullanıcının Çalma Listeleri Gizli</p>
              <p className="text-sm text-muted-foreground">Kullanıcı, çalma listelerini herkese açık olarak paylaşmıyor.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
