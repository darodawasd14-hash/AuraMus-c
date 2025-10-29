'use client';
import React, { useState, useEffect, useRef } from 'react';
import YouTube from 'react-youtube';
import type { YouTubePlayer } from 'react-youtube';
import { Home, ListMusic, MessageSquare, Users, AuraLogo, PlayIcon, PauseIcon, SkipBack, SkipForward, Volume2, VolumeX } from '@/components/icons';
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
    // ---------- HAFIZA (STATES) ----------
    const [playlist, setPlaylist] = useState<Song[]>([]);
    const [currentSong, setCurrentSong] = useState<Song | null>(null);
    const [currentIndex, setCurrentIndex] = useState(-1);
    
    // 1. YouTube kumandasının kendisi
    const [player, setPlayer] = useState<YouTubePlayer | null>(null);
    
    // 2. Tarayıcı izni (ses açma) alındı mı?
    const [soundActivated, setSoundActivated] = useState(false);
    
    // 3. Video oynuyor mu? (Bunu SADECE YouTube'dan gelen sinyal günceller)
    const [isPlaying, setIsPlaying] = useState(false);
    
    // 4. Barın o anki saniyesi
    const [currentTime, setCurrentTime] = useState(0);

    // 5. Şarkının toplam süresi
    const [duration, setDuration] = useState(0);

    // 6. Ses seviyesi (0-100)
    const [volume, setVolume] = useState(100);

    // 7. Ses kapalı mı?
    const [isMuted, setIsMuted] = useState(true);

    // 8. Barı ilerleten 'motor' (setInterval)
    const intervalRef = useRef<NodeJS.Timeout | null>(null);


    // ---------- İLK KURULUM (useEffect) ----------
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

    // ---------- VİDEO AYARLARI ----------
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
            mute: 1, // Başlangıçta sessiz başla
        },
    };

    // ---------- YOUTUBE'DAN GELEN SİNYALLER ----------
    const onPlayerReady = (event: { target: YouTubePlayer }) => {
        console.log("Kumanda (Player) hazır.");
        setPlayer(event.target);
    };

    const onPlayerStateChange = (event: { data: number }) => {
        const state = event.data;
        if (state === 1) { // Oynatılıyor
            setIsPlaying(true);
            setDuration(player?.getDuration() ?? 0);
        } else if (state === 0) { // Bitti
            setIsPlaying(false);
            playNext();
        } else { // Durdu, Yüklüyor vs.
            setIsPlaying(false);
        }
    };

    // ---------- BAR İLERLETME MOTORU (useEffect) ----------
    useEffect(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        if (isPlaying && player) {
            intervalRef.current = setInterval(() => {
                const newTime = Math.floor(player.getCurrentTime());
                setCurrentTime(newTime);
            }, 1000);
        }
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isPlaying, player]);

    // ---------- BUTON FONKSİYONLARI (DÜZELTİLMİŞ) ----------
    const playSong = (song: Song, index: number) => {
        setCurrentSong(song);
        setCurrentIndex(index);
        setCurrentTime(0);
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

    const handleActivateSound = () => {
        if (player) {
            player.playVideo();
            player.unMute();
            setSoundActivated(true);
            setIsMuted(false);
        }
    };
    
    const handlePlayPause = () => {
        if (!player) return;
        if (isPlaying) {
            player.pauseVideo();
        } else {
            if (!soundActivated) {
                handleActivateSound();
            } else {
                player.playVideo();
            }
        }
    };
    
    const handleSeek = (value: number[]) => {
        if (player) {
            const newTime = value[0];
            player.seekTo(newTime, true);
            setCurrentTime(newTime);
        }
    };

    const handleVolumeChange = (value: number[]) => {
        if (player) {
            const newVolume = value[0];
            setVolume(newVolume);
            player.setVolume(newVolume);
            if (newVolume > 0 && isMuted) {
                setIsMuted(false);
                if(!soundActivated) setSoundActivated(true);
            }
            if (newVolume === 0 && !isMuted) {
                setIsMuted(true);
            }
        }
    };

    const toggleMute = () => {
        if(player) {
            if(isMuted) {
                player.unMute();
                setIsMuted(false);
                if (volume === 0) { // If unmuting when volume is 0, set to a default
                    setVolume(50);
                    player.setVolume(50);
                }
            } else {
                player.mute();
                setIsMuted(true);
            }
        }
    };

    return (
        <div id="app-container" className="h-screen w-screen flex flex-col text-foreground bg-background overflow-hidden">
            <div className="flex flex-1 min-h-0">
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
                                {player && !soundActivated && (
                                  <div
                                      onClick={handleActivateSound}
                                      className="absolute top-0 left-0 w-full h-full bg-transparent cursor-pointer z-10"
                                  />
                                )}
                            </>
                        )}
                   </div>
                   <div className="flex-grow flex flex-col min-h-0">
                      <PlaylistView playlist={playlist} playSong={playSong} currentSong={currentSong} />
                   </div>
                </main>
                <aside className="w-96 border-l border-border">
                    <ChatPane song={currentSong} />
                </aside>
            </div>
            
             <footer className="flex-shrink-0 bg-secondary/30 border-t border-border px-6 py-3 flex items-center gap-6">
                 <div className="flex items-center gap-4 w-64">
                     {currentSong && (
                        <Image 
                            src={currentSong.artwork || `https://i.ytimg.com/vi/${currentSong.videoId}/default.jpg`}
                            alt={currentSong.title}
                            width={48}
                            height={48}
                            className="rounded-md"
                        />
                     )}
                     <div>
                        <p className="font-semibold truncate">{currentSong?.title}</p>
                     </div>
                 </div>

                 <div className="flex-grow flex flex-col items-center gap-2">
                     <div className="flex items-center gap-3">
                         <Button variant="ghost" size="icon" onClick={playPrevious} disabled={!player}>
                             <SkipBack className="w-5 h-5 fill-current" />
                         </Button>
                         <Button variant="ghost" size="icon" className="w-10 h-10 bg-primary/20 rounded-full" onClick={handlePlayPause} disabled={!player}>
                             {isPlaying ? <PauseIcon className="w-5 h-5 fill-current" /> : <PlayIcon className="w-5 h-5 fill-current" />}
                         </Button>
                         <Button variant="ghost" size="icon" onClick={playNext} disabled={!player}>
                             <SkipForward className="w-5 h-5 fill-current" />
                         </Button>
                     </div>
                     <div className="flex-grow flex items-center gap-2 w-full max-w-xl">
                        <span className="text-xs text-muted-foreground w-12 text-right">{formatTime(currentTime)}</span>
                         <Slider
                             value={[currentTime]}
                             max={duration}
                             onValueChange={handleSeek}
                             disabled={!player}
                         />
                         <span className="text-xs text-muted-foreground w-12">{formatTime(duration)}</span>
                     </div>
                 </div>

                 <div className="w-64 flex items-center justify-end gap-3">
                    <Button variant="ghost" size="icon" onClick={toggleMute} disabled={!player}>
                        {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </Button>
                    <Slider 
                        className="w-[100px]"
                        value={[isMuted ? 0 : volume]}
                        max={100}
                        onValueChange={handleVolumeChange}
                        disabled={!player}
                    />
                </div>
            </footer>
        </div>
    );
}
