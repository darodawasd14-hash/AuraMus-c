'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import YouTube from 'react-youtube';
import type { YouTubePlayer } from 'react-youtube';
import { Home, ListMusic, MessageSquare, Users, AuraLogo, PlayIcon, PauseIcon, SkipBack, SkipForward, Volume2, VolumeX, User, Music, Search, Plus, MessageCircle } from '@/components/icons';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { PlaylistView } from '@/components/playlist-view';
import { ChatPane } from '@/components/chat-pane';
import type { Song } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError, useDoc } from '@/firebase';
import { collection, query, orderBy, limit, addDoc, serverTimestamp, doc, setDoc, where } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { searchYoutube } from '@/ai/flows/youtube-search-flow';
import { AddToPlaylistDialog } from '@/components/add-to-playlist';
import { Skeleton } from '@/components/ui/skeleton';

const UnreadChatBadge = () => {
    const { user } = useUser();
    const firestore = useFirestore();

    // THIS IS THE SECURE QUERY
    const secureChatsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        // SECURE QUERY: Fetch only chats the user is a participant in.
        return query(
            collection(firestore, "chats"), 
            where("participantIds", "array-contains", user.uid)
        );
    }, [user, firestore]);

    const { data: chats, isLoading } = useCollection(secureChatsQuery);
    
    // For now, this just shows the number of chats.
    // A true "unread" count would require a field like `unreadCount` in the chat document.
    const unreadCount = chats?.length ?? 0;

    if (isLoading || unreadCount === 0) {
        return null;
    }

    return (
        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
        </span>
    );
};


interface SideNavProps {
    activeView: ActiveView;
    setActiveView: (view: ActiveView) => void;
    toggleChat: () => void;
    user: { uid: string } | null;
}

const SideNav = ({ activeView, setActiveView, toggleChat, user }: SideNavProps) => {
    
    const navItems = [
        { id: 'discover', label: 'Keşfet', icon: Home, href: '#' },
        { id: 'playlist', label: 'Çalma Listelerim', icon: ListMusic, href: '#' },
        { id: 'friends', label: 'Arkadaşlar', icon: Users, href: '#' },
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
                        href={item.href}
                        onClick={(e) => {
                            if (item.href === '#') {
                                e.preventDefault();
                                setActiveView(item.id as ActiveView);
                            }
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
                        className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-foreground transition-colors font-medium"
                    >
                        <User className="w-5 h-5" />
                        <span>Profilim</span>
                    </Link>
                )}

                 <Link
                        href={`/chat`}
                        className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-foreground transition-colors font-medium"
                    >
                        <MessageCircle className="w-5 h-5" />
                        <span className="flex-grow">Özel Sohbet</span>
                        <UnreadChatBadge />
                </Link>
                
                <a href="#" onClick={(e) => {e.preventDefault(); toggleChat();}} className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-foreground transition-colors font-medium">
                    <MessageSquare className="w-5 h-5" />
                    <span>Şarkı Sohbeti</span>
                </a>
            </nav>
        </aside>
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
            <div className="flex-grow overflow-y-auto -mr-8 pr-8">
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

const FriendCard = ({ friendId }: { friendId: string }) => {
    const firestore = useFirestore();
    const { user: currentUser } = useUser();
    const router = useRouter();

    const friendProfileRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'users', friendId);
    }, [firestore, friendId]);

    const { data: friendProfile, isLoading: isProfileLoading } = useDoc<{ displayName: string }>(friendProfileRef);

    const getChatId = (uid1: string, uid2: string) => {
        return [uid1, uid2].sort().join('_');
    };

    const handleStartChat = () => {
        if (!currentUser) return;
        const chatId = getChatId(currentUser.uid, friendId);
        router.push(`/chat/${chatId}`);
    };

    if (isProfileLoading) {
        return (
            <Card className="p-4 flex flex-col items-center gap-4 justify-between">
                <div className="flex items-center gap-4 w-full">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-[150px]" />
                        <Skeleton className="h-4 w-[100px]" />
                    </div>
                </div>
                <Skeleton className="h-9 w-full mt-2" />
            </Card>
        );
    }
    
    const displayName = friendProfile?.displayName || `Kullanıcı ${friendId.substring(0, 6)}`;
    const fallback = displayName.charAt(0).toUpperCase();

    return (
        <Card className="p-4 flex flex-col items-center gap-4 transition-colors hover:bg-secondary/50 justify-between">
            <Link href={`/profile/${friendId}`} className="w-full">
                <div className="flex items-center gap-4 cursor-pointer">
                    <Avatar className="h-12 w-12 border-2 border-primary">
                        <AvatarImage src={`https://api.dicebear.com/8.x/bottts/svg?seed=${friendId}`} />
                        <AvatarFallback>{fallback}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold truncate">{displayName}</p>
                        <p className="text-sm text-muted-foreground">Profile Git</p>
                    </div>
                </div>
            </Link>
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleStartChat}>
                <MessageCircle className="w-4 h-4 mr-2"/>
                Mesaj Gönder
            </Button>
        </Card>
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
                {isLoading && <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>}
                {following && following.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {following.map(friend => (
                            <FriendCard key={friend.id} friendId={friend.id} />
                        ))}
                    </div>
                ) : !isLoading && (
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
    const [activeView, setActiveView] = useState<ActiveView>('playlist');
    const [isChatVisible, setIsChatVisible] = useState(true);

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
            case 'friends':
                return <FriendsView />;
            default:
                return <DiscoverView onPlaySong={playSong} />;
        }
    }


    return (
        <div id="app-container" className="h-screen w-screen flex flex-col text-foreground bg-background overflow-hidden">
            <div className="flex flex-1 min-h-0">
                <SideNav activeView={activeView} setActiveView={setActiveView} toggleChat={() => setIsChatVisible(!isChatVisible)} user={user} />
                <main className="flex-1 flex flex-col p-8 gap-8 overflow-y-auto">
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

