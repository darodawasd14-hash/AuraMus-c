'use client';
import React, { useState, useEffect, useRef } from 'react';
import YouTube from 'react-youtube';
import type { YouTubePlayer } from 'react-youtube';
import { Home, ListMusic, MessageSquare, Users, AuraLogo, PlayIcon, PauseIcon, SkipBack, SkipForward } from '@/components/icons';
import Image from 'next/image';
import { PlaylistView } from '@/components/playlist-view';
import { ChatPane } from '@/components/chat-pane';
import catalog from '@/app/lib/catalog.json';
import type { Song } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

const SideNav = () => (
    <aside className="w-64 flex flex-col bg-secondary/30 border-r border-border p-4">
        <div className="flex items-center gap-2 mb-8 px-2">
            <AuraLogo className="w-8 h-8" />
            <h1 className="text-xl font-bold tracking-tighter">Aura</h1>
        </div>
        <nav className="flex flex-col gap-2">
            <a href="#" className="flex items-center gap-3 px-3 py-2 text-primary bg-primary/10 rounded-md">
                <Home className="w-5 h-5" />
                <span className="font-semibold">Keşfet</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-foreground transition-colors">
                <ListMusic className="w-5 h-5" />
                <span className="font-medium">Çalma Listelerim</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-foreground transition-colors">
                <MessageSquare className="w-5 h-5" />
                <span className="font-medium">Sohbet</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-foreground transition-colors">
                <Users className="w-5 h-5" />
                <span className="font-medium">Arkadaşlar</span>
            </a>
        </nav>
    </aside>
);

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  const date = new Date(seconds * 1000);
  const minutes = date.getUTCMinutes();
  const sec = date.getUTCSeconds();
  return `${minutes}:${sec < 10 ? '0' : ''}${sec}`;
};


export function AuraApp() {
    const [playlist, setPlaylist] = useState<Song[]>([]);
    const [currentSong, setCurrentSong] = useState<Song | null>(null);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState({ playedSeconds: 0, played: 0 });
    const [duration, setDuration] = useState(0);
    const [soundActivated, setSoundActivated] = useState(false);

    const playerRef = useRef<YouTubePlayer | null>(null);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const songsWithArt = catalog.songs.map(song => ({
            ...song,
            artwork: `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`,
        }));
        setPlaylist(songsWithArt);
        if (songsWithArt.length > 0) {
          setCurrentSong(songsWithArt[0]);
          setCurrentIndex(0);
        }
    }, []);

    const playSong = (song: Song, index: number) => {
        setCurrentSong(song);
        setCurrentIndex(index);
    };
    
    const togglePlayPause = () => {
        if (!playerRef.current) return;

        if (!soundActivated) {
            handleActivateSound();
            return;
        }

        if (isPlaying) {
            playerRef.current.pauseVideo();
        } else {
            playerRef.current.playVideo();
        }
    };
    
    const playNext = () => {
        if (playlist.length === 0) return;
        const nextIndex = (currentIndex + 1) % playlist.length;
        playSong(playlist[nextIndex], nextIndex);
    };

    const playPrevious = () => {
        if (playlist.length === 0) return;
        const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
        playSong(playlist[prevIndex], prevIndex);
    };

    const onPlayerReady = (event: { target: YouTubePlayer }) => {
        playerRef.current = event.target;
    };

    const onPlayerStateChange = (event: { data: number }) => {
        if (event.data === 1) { // Playing
            setIsPlaying(true);
            setDuration(playerRef.current?.getDuration() ?? 0);
        } else { // Paused, Ended, etc.
            setIsPlaying(false);
        }
        if (event.data === 0) { // Ended
            playNext();
        }
    };
    
    const handleSeek = (value: number[]) => {
        if (playerRef.current) {
            const newTime = value[0];
            playerRef.current.seekTo(newTime, true);
            setProgress(prev => ({...prev, playedSeconds: newTime}));
        }
    };
    
    const handleActivateSound = () => {
        if (playerRef.current && !soundActivated) {
            playerRef.current.playVideo();
            playerRef.current.unMute();
            setSoundActivated(true);
        }
    };


    useEffect(() => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
        }
        if (isPlaying) {
            progressIntervalRef.current = setInterval(() => {
                const playedSeconds = playerRef.current?.getCurrentTime() ?? 0;
                const currentDuration = playerRef.current?.getDuration() ?? 0;
                if(currentDuration > 0) {
                    setProgress({
                        playedSeconds,
                        played: playedSeconds / currentDuration,
                    });
                }
            }, 1000);
        }
        return () => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
        };
    }, [isPlaying]);


    const videoOptions = {
        height: '100%',
        width: '100%',
        playerVars: {
            autoplay: 1, 
            controls: 0,
            rel: 0,
            showinfo: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            mute: 1, // Start muted
        },
    };

    return (
        <div id="app-container" className="h-screen w-screen flex flex-col text-foreground bg-background overflow-hidden">
            <div className="flex flex-1">
                <SideNav />
                <main className="flex-1 flex flex-col p-8 gap-8 overflow-y-auto">
                    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center relative shadow-xl">
                        {currentSong?.videoId && (
                            <>
                                <YouTube
                                    videoId={currentSong.videoId}
                                    opts={videoOptions}
                                    onReady={onPlayerReady}
                                    onStateChange={onPlayerStateChange}
                                    className="w-full h-full"
                                />
                                {!soundActivated && (
                                    <div
                                        onClick={handleActivateSound}
                                        className="absolute top-0 left-0 w-full h-full bg-transparent cursor-pointer z-10"
                                    />
                                )}
                            </>
                        )}
                   </div>
                   <div className="flex-grow flex flex-col">
                      <PlaylistView playlist={playlist} playSong={playSong} currentSong={currentSong} />
                   </div>
                </main>
                <aside className="w-96 border-l border-border">
                    <ChatPane song={currentSong} />
                </aside>
            </div>
            
             <footer className="flex-shrink-0 bg-secondary/30 border-t border-border px-6 py-3 flex items-center gap-4">
                 {currentSong && (
                    <Image 
                        src={currentSong.artwork || `https://i.ytimg.com/vi/${currentSong.videoId}/default.jpg`}
                        alt={currentSong.title}
                        width={48}
                        height={48}
                        className="rounded-md"
                    />
                 )}
                 <div className="flex-grow flex items-center gap-4">
                     <div className="flex items-center gap-3">
                         <Button variant="ghost" size="icon" onClick={playPrevious} disabled={!currentSong}>
                             <SkipBack className="w-5 h-5 fill-current" />
                         </Button>
                         <Button variant="ghost" size="icon" className="w-10 h-10 bg-primary/20 rounded-full" onClick={togglePlayPause} disabled={!currentSong}>
                             {isPlaying ? <PauseIcon className="w-5 h-5 fill-current" /> : <PlayIcon className="w-5 h-5 fill-current" />}
                         </Button>
                         <Button variant="ghost" size="icon" onClick={playNext} disabled={!currentSong}>
                             <SkipForward className="w-5 h-5 fill-current" />
                         </Button>
                     </div>
                     <div className="flex-grow flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-12 text-right">{formatTime(progress.playedSeconds)}</span>
                         <Slider
                             value={[progress.playedSeconds]}
                             max={duration}
                             onValueChange={handleSeek}
                             disabled={!currentSong || !playerRef.current}
                         />
                         <span className="text-xs text-muted-foreground w-12">{formatTime(duration)}</span>
                     </div>
                 </div>
            </footer>
        </div>
    );
}
