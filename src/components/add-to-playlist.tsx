'use client';
import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Music, CheckCircle } from 'lucide-react';
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

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!user || !firestore || !song || !song.videoId) return;

    setIsAdding(playlistId);

    const playlistSongsRef = collection(firestore, 'users', user.uid, 'playlists', playlistId, 'songs');
    const globalSongRef = doc(firestore, 'songs', song.videoId);

    const songData: Song = {
      id: song.videoId,
      videoId: song.videoId,
      title: song.title,
      url: song.url,
      type: song.type,
      timestamp: serverTimestamp() // Add timestamp when added
    };

    try {
      // Check if song exists in global collection
      const songDoc = await getDoc(globalSongRef);
      if (!songDoc.exists()) {
        // Add to global songs collection if it doesn't exist
        await setDoc(globalSongRef, songData).catch(serverError => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: globalSongRef.path,
                operation: 'create',
                requestResourceData: songData,
            }));
            throw serverError; // Propagate error to stop execution
        });
      }

      // Add song to the specific playlist's subcollection
      await addDoc(playlistSongsRef, songData).catch(serverError => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: playlistSongsRef.path,
            operation: 'create',
            requestResourceData: songData,
        }));
        throw serverError; // Propagate error to stop execution
      });
      
      const selectedPlaylist = playlists?.find(p => p.id === playlistId);
      toast({
        title: "Şarkı Eklendi!",
        description: `"${song.title}" çalma listesine eklendi: ${selectedPlaylist?.name}.`,
      });

    } catch (error) {
      console.error("Listeye şarkı eklenirken hata:", error);
      toast({
        variant: "destructive",
        title: "Hata!",
        description: "Şarkı listeye eklenemedi.",
      });
    } finally {
      setIsAdding(null);
      onOpenChange(false);
    }
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

    