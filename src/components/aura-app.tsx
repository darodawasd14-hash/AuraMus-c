'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import YouTube from 'react-youtube';
import type { YouTubePlayer } from 'react-youtube';
import { Home, ListMusic, MessageSquare, User, AuraLogo, PlayIcon, PauseIcon, SkipBack, SkipForward, Volume2, VolumeX, Music, Search, Plus, Smartphone, Menu } from '@/components/icons';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { PlaylistView } from '@/components/playlist-view';
import { ChatPane } from '@/components/chat-pane';
import type { Song, ActiveView } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { searchYoutube } from '@/ai/flows/youtube-search-flow';
import { AddToPlaylistDialog } from '@/components/add-to-playlist';

interface SideNavProps {
    activeView: ActiveView;
    setActiveView: (view: ActiveView) => void;
    user: { uid: string } | null;
    onNavItemClick: () => void;
}

const SideNav = ({ activeView, setActiveView, user, onNavItemClick }: SideNavProps) => {
    const router = useRouter();
    const navItems = [
        { id: 'discover', label: 'Keşfet', icon: Home },
        { id: 'playlist', label: 'Çalma Listelerim', icon: ListMusic },
    ];

    const handleNav = (view: ActiveView) => {
        setActiveView(view);
        onNavItemClick();
    }

    return (
        <nav className="flex flex-col gap-2">
            {navItems.map(item => (
                <a
                    key={item.id}
                    href="#"
                    onClick={(e) => {
                        e.preventDefault();
                        handleNav(item.id as ActiveView);
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

            {user && (
                <Link
                    href={`/profile/${user.uid}`}
                    onClick={onNavItemClick}
                    className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-foreground transition-colors font-medium"
                >
                    <User className="w-5 h-5" />
                    <span>Profilim</span>
                </Link>
            )}
        </nav>
    );
};


const DiscoverView = ({ onPlaySong }: { onPlaySong: (song: Song, index: number, playlist: Song[]) => void }) => {
    const firestore = useFirestore();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Song[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedSong, setSelectedSong] = useState<Song | null>(null);

    const songsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'songs'), orderBy('timestamp', 'desc'), limit(50));
    }, [firestore]);

    const { data: discoverSongs, isLoading } = useCollection<Song>(songsQuery);
    
    const songsToDisplay = useMemo(() => {
        const songs = searchResults.length > 0 ? searchResults : discoverSongs;
        return songs?.map(song => ({
            ...song,
            artwork: song.artwork || `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`,
        })) || [];
    }, [discoverSongs, searchResults]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        };
        setIsSearching(true);
        try {
            const results = await searchYoutube({ query: searchQuery });
            const songs: Song[] = results.songs.map(s => ({
                id: s.videoId, // Use videoId as a temporary unique ID
                videoId: s.videoId,
                title: s.title,
                url: `https://www.youtube.com/watch?v=${s.videoId}`,
                type: 'youtube',
                artwork: s.thumbnailUrl,
            }));
            setSearchResults(songs);
        } catch (error) {
            console.error("Arama sırasında hata:", error);
        } finally {
            setIsSearching(false);
        }
    };
    
    const handleAddToPlaylist = (song: Song) => {
        setSelectedSong(song);
        setDialogOpen(true);
    };

    return (
        <div className="h-full flex flex-col">
            <AddToPlaylistDialog 
                song={selectedSong}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
            />
            <div className="mb-4">
                <form onSubmit={handleSearch} className="flex gap-2">
                    <Input 
                        placeholder="YouTube'da şarkı veya sanatçı ara..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Button type="submit" disabled={isSearching}>
                        {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
                    </Button>
                </form>
            </div>
            
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-2xl font-bold">{searchResults.length > 0 ? 'Arama Sonuçları' : 'Keşfet'}</h2>
                    <p className="text-muted-foreground text-sm">
                        {searchResults.length > 0 
                            ? `${searchResults.length} şarkı bulundu` 
                            : 'Herkesin dinlediği en yeni şarkılar'}
                    </p>
                </div>
            </div>
            <div className="flex-grow overflow-y-auto -mr-4 pr-4 md:-mr-8 md:pr-8">
                <div className="space-y-1">
                     {(isLoading || isSearching) && songsToDisplay.length === 0 && <p>Yükleniyor...</p>}
                     {songsToDisplay.map((song, index) => (
                        <div
                            key={`${song.id}-${index}`}
                            className="flex items-center gap-4 p-2 rounded-md group cursor-pointer transition-colors hover:bg-secondary/50"
                        >
                            <div className="flex-shrink-0" onClick={() => onPlaySong(song, index, songsToDisplay)}>
                                <Image 
                                    src={song.artwork || ''}
                                    alt={song.title}
                                    width={40} 
                                    height={40} 
                                    className="rounded-md aspect-square object-cover" 
                                />
                            </div>
                            <div className="flex-grow" onClick={() => onPlaySong(song, index, songsToDisplay)}>
                                <p className="font-semibold truncate group-hover:text-primary">{song.title}</p>
                                <p className="text-sm text-muted-foreground">{song.type}</p>
                            </div>
                             <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => handleAddToPlaylist(song)}>
                                 <Plus className="w-4 h-4"/>
                             </Button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
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
    const { user } = useUser();
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
    const [isChatVisible, setIsChatVisible] = useState(false);
    const [isMobileView, setIsMobileView] = useState(false);
    const [isSideNavVisible, setIsSideNavVisible] = useState(false);


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
            player.unMute();
            player.setVolume(volume);
            player.pauseVideo(); // Force a "click"
            player.playVideo();
            setSoundActivated(true);
            setIsMuted(false);
        }
    };

    // ---------- YOUTUBE'DAN GELEN SİNYALLER ----------
    const onPlayerReady = (event: { target: YouTubePlayer }) => {
        const newPlayer = event.target;
        setPlayer(newPlayer);
    };

    const onPlayerStateChange = (event: { data: number }) => {
        const state = event.data;
        if (state === 1) { // Oynatılıyor
             if (!isPlaying) setIsPlaying(true);
             if (player) setDuration(player.getDuration());
             if (!soundActivated) {
                handleActivateSound();
             }
        } else if (state === 0) { // Bitti
            if (isPlaying) setIsPlaying(false);
            playNext();
        } else { // Durdu, Yüklüyor vs.
            if (isPlaying) setIsPlaying(false);
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
                return <PlaylistView playSong={playSong} currentSong={currentSong} />;
            default:
                return <DiscoverView onPlaySong={playSong} />;
        }
    }
    
    return (
        <div
            className={cn(
                'w-screen h-screen bg-background flex items-center justify-center transition-all duration-300',
                isMobileView && 'p-2 sm:p-4'
            )}
        >
            <div
                id="app-container"
                className={cn(
                    'h-full w-full flex flex-col text-foreground bg-background overflow-hidden transition-all duration-300 relative',
                    isMobileView && 'max-w-[420px] max-h-[840px] rounded-lg sm:rounded-2xl shadow-2xl border-2 sm:border-4 border-black'
                )}
            >
                <div className="flex flex-1 min-h-0">
                    {/* -- Masaüstü Kenar Çubuğu -- */}
                    <aside className="w-64 flex-shrink-0 flex-col bg-secondary/30 border-r border-border p-4 hidden md:flex">
                        <div className="flex items-center gap-2 mb-8 px-2">
                            <AuraLogo className="w-8 h-8" />
                            <h1 className="text-xl font-bold tracking-tighter">Aura</h1>
                        </div>
                        <SideNav activeView={activeView} setActiveView={setActiveView} user={user} onNavItemClick={() => {}} />
                    </aside>
                    
                    <main className="flex-1 flex flex-col p-4 md:p-8 gap-4 md:gap-8 overflow-y-auto relative">
                        {/* -- Mobil Üst Bar -- */}
                        <div className="md:hidden flex items-center justify-between">
                            <Button variant="ghost" size="icon" onClick={() => setIsSideNavVisible(true)}>
                                <Menu className="w-6 h-6" />
                            </Button>
                             <div className="flex items-center gap-2">
                                <AuraLogo className="w-7 h-7" />
                                <h1 className="text-lg font-bold tracking-tighter">Aura</h1>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setIsChatVisible(true)}>
                                <MessageSquare className="w-5 h-5" />
                            </Button>
                        </div>
                        
                        {/* -- Masaüstü Sohbet Butonu -- */}
                        <div className="hidden md:block absolute top-4 right-4 z-10">
                            <Button variant="outline" size="sm" onClick={() => setIsChatVisible(!isChatVisible)}>
                                <MessageSquare className="w-4 h-4 mr-2" />
                                {isChatVisible ? "Sohbeti Kapat" : "Sohbeti Aç"}
                            </Button>
                        </div>
                        
                        <div className="w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center relative shadow-xl">
                            {currentSong?.videoId && (
                                <>
                                    <YouTube
                                        key={currentSong.videoId}
                                        videoId={currentSong.videoId}
                                        opts={videoOptions}
                                        onReady={onPlayerReady}
                                        onStateChange={onPlayerStateChange}
                                        className="w-full h-full"
                                    />
                                    {player && !soundActivated && (
                                        <div 
                                            className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-10 cursor-pointer"
                                            onDoubleClick={handleActivateSound}
                                        >
                                            <PlayIcon className="w-16 h-16 text-white mb-4" />
                                            <p className="text-white text-lg font-semibold">Sesi açmak için çift tıklayınız</p>
                                        </div>
                                    )}
                                </>
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

                    {/* -- Masaüstü Sohbet Paneli -- */}
                     <aside className={cn(
                        "border-l border-border flex-shrink-0 flex-col",
                        "transition-all duration-300 ease-in-out",
                        isChatVisible ? "w-96" : "w-0",
                        "hidden md:flex"
                     )}>
                        <ChatPane song={currentSong} onClose={() => setIsChatVisible(false)} isVisible={isChatVisible} />
                    </aside>
                </div>
                
                <footer className="flex-shrink-0 bg-secondary/30 border-t border-border px-4 md:px-6 py-3 flex items-center gap-4 md:gap-6">
                    <div className="hidden md:flex items-center gap-4 w-64">
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

                    <div className="w-auto md:w-64 flex items-center justify-end gap-2 md:gap-3">
                        <Button variant="ghost" size="icon" onClick={() => setIsMobileView(!isMobileView)}>
                            <Smartphone className={cn("w-5 h-5", isMobileView && "text-primary")} />
                        </Button>
                         <div className="hidden md:flex items-center gap-3">
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
                    </div>
                </footer>

                {/* -- Mobil Katmanlar (Overlays) -- */}
                {isSideNavVisible && (
                    <div className="md:hidden">
                        <div className="absolute inset-0 bg-black/60 z-40" onClick={() => setIsSideNavVisible(false)}></div>
                        <div className="absolute top-0 left-0 h-full w-64 bg-background/90 backdrop-blur-lg border-r border-border p-4 z-50 flex flex-col">
                            <div className="flex items-center gap-2 mb-8 px-2">
                                <AuraLogo className="w-8 h-8" />
                                <h1 className="text-xl font-bold tracking-tighter">Aura</h1>
                            </div>
                            <SideNav activeView={activeView} setActiveView={setActiveView} user={user} onNavItemClick={() => setIsSideNavVisible(false)} />
                        </div>
                    </div>
                )}
                {isChatVisible && (
                    <div className="md:hidden">
                        <div className="absolute inset-0 bg-background/90 backdrop-blur-lg z-30 flex flex-col">
                           <ChatPane song={currentSong} onClose={() => setIsChatVisible(false)} isVisible={true} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
