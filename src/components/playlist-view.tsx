'use client';
import React, { useContext } from 'react';
import { PlayerContext } from '@/context/player-context';
import Image from 'next/image';
import { Button } from './ui/button';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Song } from '@/lib/types';


export const PlaylistView = () => {
    const context = useContext(PlayerContext);

    if (!context) {
        return <div className="text-muted-foreground">Yükleniyor...</div>;
    }

    const { playlist, playSong, currentSong } = context;

    const handlePlaySong = (song: Song, index: number) => {
        playSong(song, index);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-2xl font-bold">Çalma Listem</h2>
                    <p className="text-muted-foreground text-sm">{playlist.length} şarkı</p>
                </div>
                <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2"/>
                    Şarkı Ekle
                </Button>
            </div>
            <div className="flex-grow overflow-y-auto -mr-8 pr-8">
                <div className="space-y-1">
                    {playlist.map((song, index) => (
                        <div
                            key={song.id}
                            onClick={() => handlePlaySong(song, index)}
                            className={cn(
                                "flex items-center gap-4 p-2 rounded-md cursor-pointer transition-colors hover:bg-secondary/50",
                                currentSong?.id === song.id && "bg-secondary"
                            )}
                        >
                            <Image 
                                src={song.artwork || `https://i.ytimg.com/vi/${song.videoId}/default.jpg`} 
                                alt={song.title} 
                                width={40} 
                                height={40} 
                                className="rounded-md aspect-square object-cover" 
                            />
                            <div className="flex-grow">
                                <p className={cn(
                                    "font-semibold truncate",
                                    currentSong?.id === song.id && "text-primary"
                                )}>
                                    {song.title}
                                </p>
                                <p className="text-sm text-muted-foreground">{song.type}</p>
                            </div>
                            {/* <p className="text-sm text-muted-foreground">3:45</p> */}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}