'use client';
import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, serverTimestamp, doc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Music } from 'lucide-react';
import type { Song } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface Playlist {
  id: string;
  name: string;
}

interface AddToPlaylistDialogProps {
  song: Song | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddToPlaylistDialog = ({ song, open, onOpenChange }: AddToPlaylistDialogProps) => {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState<string | null>(null);

  const playlistsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'playlists');
  }, [user, firestore]);

  const { data: playlists, isLoading } = useCollection<Playlist>(playlistsQuery);

  const handleAddToPlaylist = (playlistId: string) => {
    if (!user || !firestore || !song || !song.videoId) return;

    setIsAdding(playlistId);

    const playlistRef = doc(firestore, 'users', user.uid, 'playlists', playlistId);
    const newSongRef = doc(collection(playlistRef, "songs"), song.videoId);
    const globalSongRef = doc(firestore, 'songs', song.videoId);
    
    const songData: Omit<Song, 'id'> & { timestamp: any } = {
      videoId: song.videoId,
      title: song.title,
      url: song.url,
      type: song.type,
      artwork: song.artwork || `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`,
      timestamp: serverTimestamp()
    };
    
    const selectedPlaylist = playlists?.find(p => p.id === playlistId);

    setDoc(newSongRef, songData).then(() => {
        const incrementData = { songCount: increment(1) };
        updateDoc(playlistRef, incrementData).catch(async (serverError) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: playlistRef.path,
                operation: 'update',
                requestResourceData: incrementData
            }));
        });

        setDoc(globalSongRef, songData, { merge: true }).catch(async (serverError) => {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: globalSongRef.path,
                operation: 'write', 
                requestResourceData: songData,
             }));
        });
        
        toast({
            title: "Şarkı Eklendi!",
            description: `"${song.title}" çalma listesine eklendi: ${selectedPlaylist?.name}.`,
        });

    }).catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: newSongRef.path,
            operation: 'create',
            requestResourceData: songData,
        }));
        
        toast({
            variant: "destructive",
            title: "Hata!",
            description: "Şarkı çalma listenize eklenemedi.",
        });

    }).finally(() => {
        setIsAdding(null);
        onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bir Çalma Listesine Ekle</DialogTitle>
          <DialogDescription>
            "{song?.title}" şarkısını eklemek için bir liste seçin.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center"><Loader2 className="animate-spin" /></div>
          ) : playlists && playlists.length > 0 ? (
            <div className="space-y-2">
              {playlists.map(playlist => (
                <Button
                  key={playlist.id}
                  variant="ghost"
                  className="w-full justify-start gap-3"
                  onClick={() => handleAddToPlaylist(playlist.id)}
                  disabled={isAdding === playlist.id}
                >
                  {isAdding === playlist.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Music className="w-4 h-4" />
                  )}
                  {playlist.name}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center">Önce bir çalma listesi oluşturmalısın.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
