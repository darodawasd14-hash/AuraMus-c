'use client';
import React, { useState, useEffect, FormEvent } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { collection, addDoc, deleteDoc, doc, query, orderBy, Query } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Music, ShieldCheck, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { setAdminClaim } from '@/ai/flows/set-admin-claim';

const appId = 'Aura';

interface CatalogSong {
  id: string;
  title: string;
  url:string;
}

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isClaimingAdmin, setIsClaimingAdmin] = useState(false);

  const catalogCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'artifacts', appId, 'catalog');
  }, [firestore]);
  
  // IMPORTANT: Only create the query if the user is an admin
  const catalogQuery = useMemoFirebase(() => {
    if(!firestore || !isAdmin) return null;
    return query(collection(firestore, 'artifacts', appId, 'catalog'), orderBy('title', 'asc'));
  }, [firestore, isAdmin]);

  const { data: catalogSongs, isLoading: isCatalogLoading } = useCollection<CatalogSong>(catalogQuery);

  useEffect(() => {
    if (isUserLoading) return;
    
    if (!user) {
      router.push('/auth');
      return;
    }

    user.getIdTokenResult(true).then(idTokenResult => {
      const userIsAdmin = !!idTokenResult.claims.isAdmin;
      setIsAdmin(userIsAdmin);

      // If the user is not an admin and tries to access the page,
      // we show them the "Claim Admin Role" card. We don't redirect.
      if (!userIsAdmin) {
        console.log("User is not an admin.");
      }
    });
  }, [user, isUserLoading, router]);


  const handleMakeAdmin = async () => {
    if (!user || !user.email) {
      toast({ title: 'Error', description: 'User email not found.', variant: 'destructive'});
      return;
    }
    setIsClaimingAdmin(true);
    try {
        const result = await setAdminClaim({ email: 'oguzhanarman01@gmail.com' });
        toast({ title: 'Admin Claim Set!', description: 'Please log out and log back in for changes to take effect.' });
        console.log(result.message);
    } catch(e: any) {
        console.error(e);
        toast({ title: 'Error setting admin claim', description: e.message, variant: 'destructive'});
    } finally {
        setIsClaimingAdmin(false);
    }
  }

  const handleAddSong = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim() || !catalogCollectionRef) return;

    setIsAdding(true);
    const newSong = { title, url };

    addDoc(catalogCollectionRef, newSong)
      .then(() => {
        toast({ title: 'Song added to catalog!' });
        setTitle('');
        setUrl('');
      })
      .catch((err) => {
        const permissionError = new FirestorePermissionError({
            path: catalogCollectionRef.path,
            operation: 'create',
            requestResourceData: newSong,
        });
        errorEmitter.emit('permission-error', permissionError);
        // Toast is now handled by the global error listener, but we can keep a fallback
        // toast({ title: 'Error adding song', description: 'Check permissions and try again.', variant: 'destructive' });
      })
      .finally(() => {
        setIsAdding(false);
      });
  };
  
  const handleDeleteSong = async (songId: string) => {
      if (!firestore) return;
      const songDocRef = doc(firestore, 'artifacts', appId, 'catalog', songId);

      deleteDoc(songDocRef)
      .then(() => {
        toast({ title: 'Song deleted from catalog' });
      })
      .catch((err) => {
        const permissionError = new FirestorePermissionError({
            path: songDocRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        // toast({ title: 'Error deleting song', variant: 'destructive' });
      });
  }

  if (isUserLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!isAdmin) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background p-4">
            <Card className="max-w-md text-center">
                <CardHeader>
                    <CardTitle>Admin Access Required</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-muted-foreground">You do not have permission to view this page. If you are the admin, click the button below to claim your privileges.</p>
                    <Button onClick={handleMakeAdmin} disabled={isClaimingAdmin || !user}>
                        {isClaimingAdmin ? <Loader2 className="h-4 w-4 animate-spin"/> : "Claim Admin Role"}
                    </Button>
                    <p className="text-xs text-muted-foreground pt-4">After claiming, you must log out and log back in for the changes to take effect.</p>
                </CardContent>
            </Card>
        </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3"><ShieldCheck className="w-10 h-10 text-accent"/> Admin Panel</h1>
            <p className="text-muted-foreground mt-2">Manage the public music catalog for all users.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Add New Song to Catalog</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddSong} className="space-y-4">
                <div>
                  <label htmlFor="song-title" className="block text-sm font-medium text-muted-foreground mb-1">Song Title</label>
                  <Input 
                    id="song-title"
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Epic Cinematic Trailer Music"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="song-url" className="block text-sm font-medium text-muted-foreground mb-1">Song URL</label>
                  <Input 
                    id="song-url"
                    type="url" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="YouTube, SoundCloud, or direct MP3 link"
                    required
                  />
                </div>
                <Button type="submit" disabled={isAdding} className="w-full">
                  {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Song'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Catalog</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="max-h-96 overflow-y-auto space-y-2 pr-2 -mr-4">
                {isCatalogLoading ? (
                    <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
                ): !catalogSongs || catalogSongs.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                        <Music className="w-12 h-12 mx-auto mb-2"/>
                        <p>The catalog is empty.</p>
                    </div>
                ) : (
                    catalogSongs.map(song => (
                        <div key={song.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                            <p className="font-medium truncate" title={song.title}>{song.title}</p>
                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 shrink-0" onClick={() => handleDeleteSong(song.id)}>
                                <Trash2 className="w-4 h-4"/>
                            </Button>
                        </div>
                    ))
                )}
                </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
