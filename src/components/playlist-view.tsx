'use client';
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Loader2, Music, Plus, Play, Trash2 } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';
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
    songs?: Song[]; // Will be populated by the subcollection query
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

const PlaylistCard = ({ playlist, onPlayPlaylist, onDeletePlaylist, onPlaySongFromPlaylist, currentSong }: { playlist: Playlist, onPlayPlaylist: (playlist: Playlist) => void, onDeletePlaylist: (playlistId: string) => void, onPlaySongFromPlaylist: (song: Song, index: number, p: Playlist) => void, currentSong: Song | null }) => {
    const songsRef = useMemoFirebase(() => collection(useFirestore(), playlist.id), [playlist.id]);
    const { data: songs, isLoading } = useCollection<Song>(songsRef);

    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const handleDelete = () => {
        onDeletePlaylist(playlist.id);
        setDeleteDialogOpen(false);
    }
    
    const getArtwork = (song: Song | undefined) => {
        if (!song) return "https://i.ytimg.com/vi/null/hqdefault.jpg";
        return song.artwork || `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`;
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
                    <AlertDialogCancel>İptal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Sil
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Card className="overflow-hidden transition-shadow duration-300 hover:shadow-lg hover:shadow-primary/20 flex flex-col">
            <div className="relative group">
                <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-secondary to-background p-4">
                     {songs && songs.length > 0 ? (
                        <Image src={getArtwork(songs[0])} alt={songs[0].title} layout="fill" objectFit="cover" />
                     ): (
                        <Music className="h-12 w-12 text-muted-foreground/50" />
                     )}
                </div>
                 <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button variant="ghost" size="icon" className="w-12 h-12 text-white hover:bg-white/20" onClick={() => songs && songs.length > 0 && onPlayPlaylist(playlist)}>
                        <Play className="h-8 w-8 fill-current" />
                    </Button>
                </div>
            </div>
            <div className="p-4 flex flex-col flex-grow">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-semibold truncate flex-grow">{playlist.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{songs?.length ?? 0} şarkı</p>
                    </div>
                     <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteDialogOpen(true)}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
                 {songs && songs.length > 0 && (
                    <div className="mt-2 space-y-1 overflow-hidden">
                        {songs.slice(0, 3).map((song, index) => (
                           <div key={song.id} onClick={() => onPlaySongFromPlaylist(song, index, playlist)} className={cn("flex items-center gap-2 text-sm p-1 rounded-md cursor-pointer hover:bg-secondary", currentSong?.id === song.id ? "bg-primary/20" : "")}>
                               <Image src={getArtwork(song)} alt={song.title} width={24} height={24} className="rounded-sm" />
                               <span className="truncate">{song.title}</span>
                           </div>
                        ))}
                    </div>
                )}
            </div>
        </Card>
        </>
    );
};


export const PlaylistView: React.FC<PlaylistViewProps> = ({ playSong, currentSong }) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);

    const playlistsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, 'users', user.uid, 'playlists');
    }, [user, firestore]);

    const { data: playlists, isLoading } = useCollection<Playlist>(playlistsQuery);

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
        try {
            // Note: This does not delete subcollections in the client SDK.
            // A cloud function would be needed for full cleanup.
            await deleteDoc(playlistDocRef);
        } catch(serverError: any) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: playlistDocRef.path,
                operation: 'delete',
            }));
        }
    };
    
    const handlePlayPlaylist = (playlist: Playlist) => {
         const songsRef = collection(firestore, 'users', user.uid, 'playlists', playlist.id, 'songs');
         // This is a simplified approach. A more robust way would be to fetch the songs.
         // For now, we assume the subcollection hook in the card has populated the songs.
         const songs = playlist.songs || [];
         if (songs.length > 0) {
            playSong(songs[0], 0, songs);
         }
    };
    
    const handlePlaySongFromPlaylist = (song: Song, index: number, p: Playlist) => {
        const songsRef = collection(firestore, 'users', user.uid, 'playlists', p.id, 'songs');
        // This is a simplified approach.
        const songs = p.songs || [];
         if (songs.length > 0) {
            playSong(song, index, songs);
         }
    }


    return (
         <div className="h-full flex flex-col">
            <CreatePlaylistDialog 
                open={isCreateDialogOpen} 
                onOpenChange={setCreateDialogOpen} 
                onCreate={handleCreatePlaylist}
            />
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-2xl font-bold">Çalma Listelerim</h2>
                    <p className="text-muted-foreground text-sm">{playlists?.length ?? 0} çalma listesi</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni Çalma Listesi
                </Button>
            </div>
            <div className="flex-grow overflow-y-auto -mr-8 pr-8">
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
                                onPlayPlaylist={handlePlayPlaylist}
                                onDeletePlaylist={handleDeletePlaylist}
                                onPlaySongFromPlaylist={handlePlaySongFromPlaylist}
                                currentSong={currentSong}
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
