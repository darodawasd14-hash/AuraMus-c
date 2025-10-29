'use client';
import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, doc, runTransaction } from 'firebase/firestore';
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

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!user || !firestore || !song || !song.videoId) return;

    setIsAdding(playlistId);

    const playlistRef = doc(firestore, 'users', user.uid, 'playlists', playlistId);
    const globalSongRef = doc(firestore, 'songs', song.videoId);

    const songData: Omit<Song, 'id'> & { timestamp: any } = {
      videoId: song.videoId,
      title: song.title,
      url: song.url,
      type: song.type,
      artwork: song.artwork || `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`,
      timestamp: serverTimestamp() // Add timestamp when added
    };

    try {
        await runTransaction(firestore, async (transaction) => {
            const playlistDoc = await transaction.get(playlistRef);
            if (!playlistDoc.exists()) {
                throw "Çalma listesi bulunamadı!";
            }

            const newSongRef = doc(collection(playlistRef, "songs"), song.videoId);
            
            const existingSongDoc = await transaction.get(newSongRef);
            if(existingSongDoc.exists()) {
                 throw new Error("Bu şarkı zaten listede mevcut.");
            }

            // 1. Add the song to the playlist's subcollection
            transaction.set(newSongRef, songData);

            // 2. Update the song count on the main playlist document
            const currentSongCount = playlistDoc.data().songCount || 0;
            transaction.update(playlistRef, { songCount: currentSongCount + 1 });
            
            // 3. Add to global songs collection if it doesn't exist
            const globalSongDoc = await transaction.get(globalSongRef);
            if (!globalSongDoc.exists()) {
                transaction.set(globalSongRef, songData);
            }
        });

      const selectedPlaylist = playlists?.find(p => p.id === playlistId);
      toast({
        title: "Şarkı Eklendi!",
        description: `"${song.title}" çalma listesine eklendi: ${selectedPlaylist?.name}.`,
      });

    } catch (error: any) {
      console.error("Listeye şarkı eklenirken hata:", error);
      
      if (error.message === "Bu şarkı zaten listede mevcut.") {
         toast({
            variant: "default",
            title: "Bilgi",
            description: error.message,
         });
      } else {
         toast({
            variant: "destructive",
            title: "Hata!",
            description: "Şarkı listeye eklenemedi. İzinlerinizi kontrol edin veya daha sonra tekrar deneyin.",
         });
      }
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