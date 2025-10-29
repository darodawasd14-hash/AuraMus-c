'use client';
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Loader2, Music, Plus } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Song } from '@/lib/types';
import { Card } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
            createdAt: serverTimestamp()
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
                            <Card key={playlist.id} className="overflow-hidden transition-shadow duration-300 hover:shadow-lg hover:shadow-primary/20">
                                <div className="flex cursor-pointer flex-col h-full">
                                    <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-secondary to-background p-4">
                                        <Music className="h-12 w-12 text-muted-foreground/50" />
                                    </div>
                                    <div className="p-4 flex flex-col flex-grow">
                                        <p className="font-semibold truncate flex-grow">{playlist.name}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{playlist.songCount ?? 0} şarkı</p>
                                    </div>
                                </div>
                            </Card>
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