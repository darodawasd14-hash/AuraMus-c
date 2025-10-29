'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import YouTube from 'react-youtube';
import type { YouTubePlayer } from 'react-youtube';
import { Home, ListMusic, MessageSquare, Users, AuraLogo, PlayIcon, PauseIcon, SkipBack, SkipForward, Volume2, VolumeX, User, Music } from '@/components/icons';
import Image from 'next/image';
import { PlaylistView } from '@/components/playlist-view';
import { ChatPane } from '@/components/chat-pane';
import catalog from '@/app/lib/catalog.json';
import type { Song } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';


type ActiveView = 'playlist' | 'discover' | 'friends';

interface SideNavProps {
    activeView: ActiveView;
    setActiveView: (view: ActiveView) => void;
    toggleChat: () => void;
}

const SideNav = ({ activeView, setActiveView, toggleChat }: SideNavProps) => {
    
    const navItems = [
        { id: 'discover', label: 'Keşfet', icon: Home },
        { id: 'playlist', label: 'Çalma Listelerim', icon: ListMusic },
        { id: 'friends', label: 'Arkadaşlar', icon: Users },
    ];

    return (
        <aside className="w-64 flex flex-col bg-secondary/30 border-r border-border p-4">
            <div className="flex items-center gap-2 mb-8 px-2">
                <AuraLogo className="w-8 h-8" />
                <h1 className="text-xl font-bold tracking-tighter">Aura</h1>
            </div>
            <nav className="flex flex-col gap-2">
                {navItems.map(item => (
                    <a
                        key={item.id}
                        href="#"
                        onClick={(e) => {
                            e.preventDefault();
                            setActiveView(item.id as ActiveView);
                        }}
                        className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                            activeView === item.id 
                                ? "text-primary bg-primary/10 font-semibold"
                                : "text-muted-foreground hover:text-foreground font-medium"
                        )}
                    >
                        <item.icon className="w-5 h-5" />
                        <span>{item.label}</span>
                    </a>
                ))}
                <a href="#" onClick={(e) => {e.preventDefault(); toggleChat();}} className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-foreground transition-colors font-medium">
                    <MessageSquare className="w-5 h-5" />
                    <span>Sohbet</span>
                </a>
            </nav>
        </aside>
    );
};


const DiscoverView = ({ onPlaySong }: { onPlaySong: (song: Song, index: number, playlist: Song[]) => void }) => {
    const firestore = useFirestore();
    
    const songsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'songs'), orderBy('timestamp', 'desc'), limit(50));
    }, [firestore]);

    const { data: discoverSongs, isLoading } = useCollection<Song>(songsQuery);
    
    const songsWithArt = useMemo(() => {
        return discoverSongs?.map(song => ({
            ...song,
            artwork: `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`,
        })) || [];
    }, [discoverSongs]);

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-2xl font-bold">Keşfet</h2>
                    <p className="text-muted-foreground text-sm">Herkesin dinlediği en yeni şarkılar</p>
                </div>
            </div>
            <div className="flex-grow overflow-y-auto -mr-8 pr-8">
                <div className="space-y-1">
                     {isLoading && <p>Yükleniyor...</p>}
                     {songsWithArt.map((song, index) => (
                        <div
                            key={song.id}
                            onClick={() => onPlaySong(song, index, songsWithArt)}
                            className="flex items-center gap-4 p-2 rounded-md cursor-pointer transition-colors hover:bg-secondary/50"
                        >
                            <Image 
                                src={song.artwork || ''}
                                alt={song.title}
                                width={40} 
                                height={40} 
                                className="rounded-md aspect-square object-cover" 
                            />
                            <div className="flex-grow">
                                <p className="font-semibold truncate">{song.title}</p>
                                <p className="text-sm text-muted-foreground">{song.type}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const FriendsView = () => {
    const { user } = useUser();
    const firestore = useFirestore();

    const followingQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, 'users', user.uid, 'following');
    }, [user, firestore]);
    
    const { data: following, isLoading } = useCollection<{uid: string}>(followingQuery);

    return (
         <div className="h-full flex flex-col">
            <div className="mb-4">
                <h2 className="text-2xl font-bold">Arkadaşlar</h2>
                <p className="text-muted-foreground text-sm">Takip ettiğin kişiler</p>
            </div>
            <div className="flex-grow overflow-y-auto -mr-8 pr-8">
                {isLoading && <p>Yükleniyor...</p>}
                {following && following.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {following.map(friend => (
                           <Link href={`/profile/${friend.id}`} key={friend.id}>
                             <Card  className="p-4 flex items-center gap-4 transition-colors hover:bg-secondary/50 cursor-pointer">
                                 <Avatar className="h-12 w-12 border-2 border-primary">
                                     <AvatarImage src={`https://api.dicebear.com/8.x/bottts/svg?seed=${friend.id}`} />
                                     <AvatarFallback>{friend.id.charAt(0)}</AvatarFallback>
                                 </Avatar>
                                 <div>
                                     {/* We need to fetch the user profile to get the name */}
                                     <p className="font-semibold truncate">Kullanıcı {friend.id.substring(0, 6)}</p>
                                     <p className="text-sm text-muted-foreground">Proile Git</p>
                                 </div>
                             </Card>
                           </Link>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 text-center h-full">
                      <Users className="mb-4 h-12 w-12 text-muted-foreground" />
                      <p className="font-semibold">Henüz kimseyi takip etmiyorsun</p>
                      <p className="text-sm text-muted-foreground">Keşfetmeye başla!</p>
                    </div>
                )}
            </div>
        </div>
    )
};


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
    
    // Oynatıcı ve UI durumları
    const [player, setPlayer] = useState<YouTubePlayer | null>(null);
    const [soundActivated, setSoundActivated] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(100);
    const [isMuted, setIsMuted] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Navigasyon ve görünüm durumları
    const [activeView, setActiveView] = useState<ActiveView>('discover');
    const [isChatVisible, setIsChatVisible] = useState(true);

    // ---------- İLK KURULUM (useEffect) ----------
    useEffect(() => {
        const songsWithArt = catalog.songs.map(song => ({
            ...song,
            artwork: `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`,
        }));
        // Keşfet görünümü başlangıçta şarkıları kendisi çekeceği için burayı kaldırıyoruz
        // setPlaylist(songsWithArt);
        // if (songsWithArt.length > 0) {
        //     playSong(songsWithArt[0], 0, songsWithArt);
        // }
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
            mute: 1, 
        },
    };

    const handleActivateSound = () => {
        if (player && !soundActivated) {
            player.pauseVideo();
            player.playVideo();
            player.unMute();
            player.setVolume(volume);
            setSoundActivated(true);
            setIsMuted(false);
        }
    };

    // ---------- YOUTUBE'DAN GELEN SİNYALLER ----------
    const onPlayerReady = (event: { target: YouTubePlayer }) => {
        const newPlayer = event.target;
        setPlayer(newPlayer);
        if (isMuted) {
            newPlayer.mute();
        } else {
            newPlayer.unMute();
            newPlayer.setVolume(volume);
        }
        handleActivateSound();
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

    // ---------- BUTON FONKSİYONLARI ----------
    const playSong = (song: Song, index: number, newPlaylist: Song[]) => {
        setPlaylist(newPlaylist);
        setCurrentSong(song);
        setCurrentIndex(index);
        setCurrentTime(0);
        setSoundActivated(false); 
    };

    const playNext = () => {
        if (playlist.length === 0) return;
        const nextIndex = (currentIndex + 1) % playlist.length;
        playSong(playlist[nextIndex], nextIndex, playlist);
    };

    const playPrevious = () => {
        if (playlist.length === 0) return;
        const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
        playSong(playlist[prevIndex], prevIndex, playlist);
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
                if(!soundActivated) handleActivateSound();
                 else player.unMute();
            }
            if (newVolume === 0 && !isMuted) {
                setIsMuted(true);
                player.mute();
            }
        }
    };

    const toggleMute = () => {
        if(player) {
            if(isMuted) {
                player.unMute();
                setIsMuted(false);
                if (volume === 0) {
                    setVolume(50);
                    player.setVolume(50);
                }
            } else {
                player.mute();
                setIsMuted(true);
            }
        }
    };
    
    const renderActiveView = () => {
        switch (activeView) {
            case 'discover':
                return <DiscoverView onPlaySong={playSong} />;
            case 'playlist':
                 const myPlaylist = catalog.songs.map(song => ({ ...song, artwork: `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg` }));
                return <PlaylistView playlist={myPlaylist} playSong={(song, index) => playSong(song, index, myPlaylist)} currentSong={currentSong} />;
            case 'friends':
                return <FriendsView />;
            default:
                return <DiscoverView onPlaySong={playSong} />;
        }
    }


    return (
        <div id="app-container" className="h-screen w-screen flex flex-col text-foreground bg-background overflow-hidden">
            <div className="flex flex-1 min-h-0">
                <SideNav activeView={activeView} setActiveView={setActiveView} toggleChat={() => setIsChatVisible(!isChatVisible)} />
                <main className="flex-1 flex flex-col p-8 gap-8 overflow-y-auto">
                    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center relative shadow-xl">
                        {currentSong?.videoId && (
                            <YouTube
                                key={currentSong.id}
                                videoId={currentSong.videoId}
                                opts={videoOptions}
                                onReady={onPlayerReady}
                                onStateChange={onPlayerStateChange}
                                className="w-full h-full"
                            />
                        )}
                        {!currentSong && (
                            <div className="text-center text-muted-foreground">
                                <Music className="w-16 h-16 mx-auto mb-4"/>
                                <p>Başlamak için bir şarkı seçin</p>
                            </div>
                        )}
                   </div>
                   <div className="flex-grow flex flex-col min-h-0">
                      {renderActiveView()}
                   </div>
                </main>
                {isChatVisible && (
                     <aside className="w-96 border-l border-border transition-all duration-300">
                        <ChatPane song={currentSong} />
                    </aside>
                )}
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

    