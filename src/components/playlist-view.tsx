'use client';
import React, { useState, useMemo } from 'react';
import { Button } from './ui/button';
import { Loader2, Music, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, deleteDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Song } from '@/lib/types';
import { Card } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface Playlist {
    id: string;
    name: string;
    songCount?: number;
}

interface PlaylistViewProps {
    playSong: (song: Song, index: number, playlist: Song[]) => void;
    currentSong: Song | null;
}


const CreatePlaylistDialog = ({ open, onOpenChange, onCreate }: { open: boolean, onOpenChange: (open: boolean) => void, onCreate: (name: string) => void }) => {
    const [name, setName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) return;
        setIsCreating(true);
        await onCreate(name);
        setIsCreating(false);
        onOpenChange(false);
        setName('');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Yeni Çalma Listesi Oluştur</DialogTitle>
                    <DialogDescription>
                        Yeni çalma listenize bir isim verin.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            İsim
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="col-span-3"
                            placeholder="Parti Müzikleri, Yolculuk..."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
                        {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Oluştur
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const PlaylistCard = ({ playlist, songCount, onSelect, onDeletePlaylist }: { playlist: Playlist, songCount: number, onSelect: (playlist: Playlist) => void, onDeletePlaylist: (playlistId: string) => void }) => {
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDeletePlaylist(playlist.id);
        setDeleteDialogOpen(false);
    }

    return (
        <>
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                    <AlertDialogDescription>
                        "{playlist.name}" çalma listesi kalıcı olarak silinecektir. Bu işlem geri alınamaz.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={(e) => e.stopPropagation()}>İptal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Sil
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Card onClick={() => onSelect(playlist)} className="overflow-hidden transition-shadow duration-300 hover:shadow-lg hover:shadow-primary/20 flex flex-col cursor-pointer">
            <div className="relative group">
                <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-secondary to-background p-4">
                     <Music className="h-12 w-12 text-muted-foreground/50" />
                </div>
            </div>
            <div className="p-4 flex flex-col flex-grow">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-semibold truncate flex-grow">{playlist.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{songCount} şarkı</p>
                    </div>
                     <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-destructive" onClick={(e) => {e.stopPropagation(); setDeleteDialogOpen(true)}}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </Card>
        </>
    );
};


export const PlaylistView: React.FC<PlaylistViewProps> = ({ playSong, currentSong }) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
    const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

    const playlistsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, 'users', user.uid, 'playlists');
    }, [user, firestore]);
    
    const { data: playlists, isLoading } = useCollection<Playlist>(playlistsQuery);

    const songsQuery = useMemoFirebase(() => {
        if (!user || !firestore || !selectedPlaylist) return null;
        return query(collection(firestore, 'users', user.uid, 'playlists', selectedPlaylist.id, 'songs'), orderBy('timestamp', 'asc'));
    }, [user, firestore, selectedPlaylist]);

    const { data: selectedPlaylistSongs, isLoading: areSongsLoading } = useCollection<Song>(songsQuery);

    const handleCreatePlaylist = async (name: string) => {
        if (!user || !firestore || !playlistsQuery) return;

        const playlistData = {
            name: name,
            userId: user.uid,
            createdAt: serverTimestamp(),
            songCount: 0
        };

        try {
            await addDoc(playlistsQuery, playlistData);
        } catch (serverError: any) {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: playlistsQuery.path,
                operation: 'create',
                requestResourceData: playlistData,
            }));
        }
    };
    
    const handleDeletePlaylist = async (playlistId: string) => {
      if (!user || !firestore) return;
      const playlistDocRef = doc(firestore, 'users', user.uid, 'playlists', playlistId);
      
      const songsCollectionRef = collection(playlistDocRef, 'songs');
      const songsSnapshot = await getDocs(songsCollectionRef).catch(serverError => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: songsCollectionRef.path,
          operation: 'list'
        }));
        throw serverError; // Stop execution if we can't list songs
      });

      const deletePromises = songsSnapshot.docs.map((songDoc) => 
        deleteDoc(songDoc.ref).catch(serverError => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: songDoc.ref.path,
            operation: 'delete'
          }));
        })
      );
      
      await Promise.all(deletePromises);
      
      deleteDoc(playlistDocRef).catch(serverError => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: playlistDocRef.path,
          operation: 'delete',
        }));
      });

      if (selectedPlaylist?.id === playlistId) {
          setSelectedPlaylist(null);
      }
    };
    
    const handlePlaySongFromPlaylist = (song: Song, index: number) => {
         if (selectedPlaylistSongs && selectedPlaylistSongs.length > 0) {
            playSong(song, index, selectedPlaylistSongs);
         }
    }
    
    const handleSelectPlaylist = (playlist: Playlist) => {
        setSelectedPlaylist(playlist);
    };

    const getArtwork = (song: Song | undefined) => {
        if (!song || !song.videoId) return "/placeholder.png";
        return song.artwork || `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`;
    }

    if (selectedPlaylist) {
        return (
            <div className="h-full flex flex-col">
                 <div className="flex justify-between items-center mb-4 px-4 md:px-0">
                    <div>
                        <Button variant="ghost" onClick={() => setSelectedPlaylist(null)} className="mb-2 -ml-4">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Geri
                        </Button>
                        <h2 className="text-2xl font-bold">{selectedPlaylist.name}</h2>
                        <p className="text-muted-foreground text-sm">{selectedPlaylistSongs?.length ?? 0} şarkı</p>
                    </div>
                     <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeletePlaylist(selectedPlaylist.id)}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Listeyi Sil
                    </Button>
                </div>
                <div className="flex-grow overflow-y-auto px-4 md:px-0 -mr-4 pr-4">
                     {areSongsLoading && (
                        <div className="flex justify-center items-center h-full">
                           <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                     )}
                     <div className="space-y-1">
                        {!areSongsLoading && selectedPlaylistSongs?.map((song, index) => (
                             <div
                                key={song.id}
                                onClick={() => handlePlaySongFromPlaylist(song, index)}
                                className={cn(
                                    "flex items-center gap-4 p-2 rounded-md group cursor-pointer transition-colors hover:bg-secondary/50",
                                    currentSong?.videoId === song.videoId && "bg-primary/20 text-primary-foreground"
                                    )}
                            >
                                <Image 
                                    src={getArtwork(song)}
                                    alt={song.title}
                                    width={40} 
                                    height={40} 
                                    className="rounded-md aspect-square object-cover" 
                                />
                                <div className="flex-grow">
                                    <p className="font-semibold truncate group-hover:text-primary">{song.title}</p>
                                    <p className="text-sm text-muted-foreground">{song.type}</p>
                                </div>
                            </div>
                        ))}
                         {!areSongsLoading && selectedPlaylistSongs?.length === 0 && (
                            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 text-center">
                                <Music className="mb-4 h-12 w-12 text-muted-foreground" />
                                <p className="font-semibold">Bu çalma listesi boş</p>
                                <p className="text-sm text-muted-foreground">"Keşfet" sekmesinden yeni şarkılar ekle.</p>
                            </div>
                         )}
                    </div>
                </div>
            </div>
        )
    }


    return (
         <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-4 px-4 pt-4 md:px-0 md:pt-0">
                <div>
                    <h2 className="text-2xl font-bold">Çalma Listelerim</h2>
                    <p className="text-muted-foreground text-sm">{playlists?.length ?? 0} çalma listesi</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni Liste
                </Button>
            </div>
             <CreatePlaylistDialog 
                open={isCreateDialogOpen} 
                onOpenChange={setCreateDialogOpen} 
                onCreate={handleCreatePlaylist}
            />
            <div className="flex-grow overflow-y-auto px-4 md:px-0 -mr-4 pr-4">
                 {isLoading && (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                 )}
                {!isLoading && playlists && playlists.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {playlists.map(playlist => (
                            <PlaylistCard 
                                key={playlist.id} 
                                playlist={playlist}
                                songCount={playlist.songCount ?? 0}
                                onSelect={handleSelectPlaylist}
                                onDeletePlaylist={handleDeletePlaylist}
                            />
                        ))}
                    </div>
                ) : !isLoading && (
                    <div 
                        onClick={() => setCreateDialogOpen(true)}
                        className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 text-center h-full cursor-pointer hover:border-primary hover:text-primary transition-colors"
                    >
                        <Music className="mb-4 h-12 w-12 text-muted-foreground" />
                        <p className="font-semibold">Henüz çalma listen yok</p>
                        <p className="text-sm text-muted-foreground">İlk çalma listeni oluşturmak için tıkla.</p>
                     </div>
                )}
            </div>
        </div>
    );
}
