'use client';
import React, { useState, useEffect, FormEvent, useMemo } from 'react';
import { usePlayer } from '@/context/player-context';
import type { Song } from '@/context/player-context';
import { Player } from '@/components/player';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuraLogo, PlayIcon, PauseIcon, SkipBack, SkipForward, Trash2, ListMusic, Music, User as UserIcon, Search, MessageSquare, X, Plus, ChevronDown } from '@/components/icons';
import { useUser, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { ChatPane } from '@/components/chat-pane';
import { searchYoutube } from '@/ai/flows/youtube-search-flow';
import Image from 'next/image';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useCollection, useMemoFirebase } from '@/firebase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';


interface UserProfile {
  displayName?: string;
}

export function AuraApp() {
  const { currentSong, isPlaying, togglePlayPause, playNext, playPrev, isPlayerOpen, setIsPlayerOpen, progress, duration, _seekTo, _setIsSeeking } = usePlayer();
  const [view, setView] = useState<'playlist' | 'catalog' | 'search'>('playlist');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const { user } = useUser();

  const handleTogglePlayer = () => {
    if (currentSong) {
      setIsPlayerOpen(prev => !prev);
    }
  };
  
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsChatOpen(false);
      } else {
        setIsChatOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div id="app-container" className="h-screen w-screen flex flex-col text-foreground bg-background overflow-hidden">
      
      <div className="w-0 h-0 overflow-hidden">
          <Player song={currentSong} />
      </div>

      <Header isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} />
      
      <main className="flex-grow flex flex-row overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-grow flex flex-col overflow-y-auto pb-32">
          {view === 'playlist' && <PlaylistView />}
          {view === 'catalog' && <CatalogView setView={setView} />}
          {view === 'search' && <SearchView setView={setView} />}
        </div>
        
        {/* Chat Pane - visible on medium screens and up if toggled */}
        <div className={cn(
          "hidden md:flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out bg-background/50", 
          isChatOpen ? "w-80 border-l border-border" : "w-0 border-l-0"
        )}>
           {user && <ChatPane song={currentSong} />}
        </div>

        {/* Chat Pane - modal-like on small screens */}
        {isChatOpen && (
             <div className="md:hidden fixed inset-0 bg-black/60 z-30" onClick={() => setIsChatOpen(false)}>
                <div className="absolute right-0 top-0 h-full w-4/5 max-w-sm bg-background border-l border-border animate-in slide-in-from-right-full duration-300" onClick={e => e.stopPropagation()}>
                    {user && <ChatPane song={currentSong} />}
                </div>
            </div>
        )}
      </main>

       {currentSong && (
        <PlayerBar 
          song={currentSong} 
          isPlaying={isPlaying} 
          onPlayPause={togglePlayPause} 
          onNext={playNext} 
          onClick={handleTogglePlayer}
          progress={progress}
          duration={duration}
          onSeek={_seekTo}
          onSeeking={_setIsSeeking}
        />
      )}
      
      <BottomNavBar currentView={view} setView={setView} />
      
      {isPlayerOpen && (
        <FullPlayerView song={currentSong} onClose={() => setIsPlayerOpen(false)} />
      )}
    </div>
  );
}

const Header = ({ isChatOpen, setIsChatOpen }: { isChatOpen: boolean, setIsChatOpen: (isOpen: boolean) => void }) => {
  const { user } = useUser();
  return (
    <header className="flex items-center justify-between p-4 bg-secondary/30 border-b border-border shadow-md backdrop-blur-sm z-20 flex-shrink-0">
      <div className="flex items-center gap-2">
        <AuraLogo className="w-8 h-8" />
        <span className="text-xl font-bold tracking-tight">Aura</span>
      </div>
      <div className="flex items-center gap-2">
        {user && (
          <Link href={`/profile/${user.uid}`} passHref>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <UserIcon/>
            </Button>
          </Link>
        )}
        <Button onClick={() => setIsChatOpen(!isChatOpen)} variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          {isChatOpen ? <X /> : <MessageSquare />}
        </Button>
      </div>
    </header>
  );
};


const BottomNavBar = ({ currentView, setView }: { currentView: string, setView: (view: 'playlist' | 'catalog' | 'search') => void }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-secondary/50 border-t border-border backdrop-blur-lg z-20 flex justify-around items-center">
      <button onClick={() => setView('playlist')} className={cn('nav-button', {'active': currentView === 'playlist'})}>
        <ListMusic/>
        <span>Listem</span>
      </button>
       <button onClick={() => setView('catalog')} className={cn('nav-button', {'active': currentView === 'catalog'})}>
        <Music/>
        <span>Katalog</span>
      </button>
       <button onClick={() => setView('search')} className={cn('nav-button', {'active': currentView === 'search'})}>
        <Search/>
        <span>Ara</span>
      </button>
    </nav>
  )
}

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};


const PlayerBar = ({ song, isPlaying, onPlayPause, onNext, onClick, progress, duration, onSeek, onSeeking }: { song: Song, isPlaying: boolean, onPlayPause: () => void, onNext: () => void, onClick: () => void, progress: number, duration: number, onSeek: (time: number) => void, onSeeking: (isSeeking: boolean) => void}) => {
  const [sliderValue, setSliderValue] = useState(progress);
  const { isSeeking } = usePlayer();

  useEffect(() => {
    if (!isSeeking) {
      setSliderValue(progress);
    }
  }, [progress, isSeeking]);

  const handleSeekCommit = (value: number[]) => {
    onSeek(value[0]);
    onSeeking(false);
  };
  
  const handlePointerDown = () => {
    onSeeking(true);
  }

  const handleValueChange = (value: number[]) => {
    setSliderValue(value[0]);
  }

  return (
    <div className="fixed bottom-16 left-0 right-0 h-20 bg-muted/80 backdrop-blur-lg border-t border-border z-20 flex flex-col justify-center px-4 group">
      <div className="flex items-center w-full">
        <div onClick={onClick} className="flex items-center gap-4 flex-grow min-w-0 cursor-pointer">
          {song.videoId && (
              <Image 
                  src={`https://i.ytimg.com/vi/${song.videoId}/default.jpg`}
                  alt={song.title}
                  width={48}
                  height={48}
                  className="rounded"
              />
          )}
          <div className="truncate">
              <p className="font-semibold text-sm truncate">{song.title}</p>
              <p className="text-xs text-muted-foreground">{song.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 pl-4">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onPlayPause(); }}>
              {isPlaying ? <PauseIcon className="w-6 h-6"/> : <PlayIcon className="w-6 h-6"/>}
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onNext(); }}>
              <SkipForward className="w-6 h-6"/>
          </Button>
        </div>
      </div>
      <div className="w-full flex items-center gap-2 mt-1">
        <span className="text-xs text-muted-foreground w-10 text-right">{formatTime(sliderValue)}</span>
        <Slider
            value={[sliderValue]}
            max={duration || 1}
            step={1}
            onValueChange={handleValueChange}
            onPointerDown={handlePointerDown}
            onValueCommit={handleSeekCommit}
            className="flex-grow"
        />
        <span className="text-xs text-muted-foreground w-10">{formatTime(duration)}</span>
      </div>
    </div>
  )
}

const FullPlayerView = ({ song, onClose }: { song: Song | null, onClose: () => void }) => {
    const { isPlaying, togglePlayPause, playNext, playPrev, progress, duration, _seekTo, _setIsSeeking } = usePlayer();

    if (!song) return null;
    
    const [sliderValue, setSliderValue] = useState(progress);
    const { isSeeking } = usePlayer();

    useEffect(() => {
        if (!isSeeking) {
            setSliderValue(progress);
        }
    }, [progress, isSeeking]);

    const handleSeekCommit = (value: number[]) => {
        _seekTo(value[0]);
        _setIsSeeking(false);
    };
    
    const handlePointerDown = () => {
        _setIsSeeking(true);
    }

    const handleValueChange = (value: number[]) => {
        setSliderValue(value[0]);
    }


    return (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-2xl z-50 flex flex-col p-4 animate-in fade-in-0 slide-in-from-bottom-10 duration-500">
            <header className="flex-shrink-0 flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={onClose}><ChevronDown className="w-8 h-8"/></Button>
                <span className="text-sm font-bold uppercase text-muted-foreground">Şimdi Oynatılıyor</span>
                <div className="w-10"></div>
            </header>
            <main className="flex-grow flex flex-col items-center justify-center gap-8 text-center">
                <div className="w-full max-w-md aspect-square rounded-lg shadow-2xl overflow-hidden">
                     <Image 
                        src={`https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`}
                        alt={song.title}
                        width={640}
                        height={640}
                        className="w-full h-full object-cover"
                     />
                </div>
                <div className="w-full max-w-md">
                    <h2 className="text-3xl font-bold tracking-tight truncate">{song.title}</h2>
                    <p className="text-muted-foreground mt-1">{song.type}</p>
                </div>
                {/* Progress Bar for Full Player */}
                <div className="w-full max-w-md px-2">
                    <Slider
                        value={[sliderValue]}
                        max={duration || 1}
                        step={1}
                        onValueChange={handleValueChange}
                        onPointerDown={handlePointerDown}
                        onValueCommit={handleSeekCommit}
                        className="flex-grow"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>{formatTime(sliderValue)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                <div className="flex items-center justify-center space-x-4">
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground w-16 h-16" onClick={playPrev}>
                      <SkipBack className="w-8 h-8" />
                    </Button>
                    <Button variant="ghost" size="icon" className="bg-primary/20 text-primary-foreground rounded-full w-20 h-20 hover:bg-primary/30" onClick={togglePlayPause}>
                      {isPlaying ? <PauseIcon className="w-10 h-10" /> : <PlayIcon className="w-10 h-10" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground w-16 h-16" onClick={playNext}>
                      <SkipForward className="w-8 h-8" />
                    </Button>
                  </div>
            </main>
        </div>
    )
}

const PlaylistView = () => {
  const { 
    playlist, 
    currentIndex, 
    playSong, 
    addSong, 
    deleteSong, 
    isLoading: isPlayerLoading,
    userPlaylists,
    activePlaylistId,
    setActivePlaylistId,
    createPlaylist
  } = usePlayer();

  const [songUrl, setSongUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const { user } = useUser();
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const { toast } = useToast();

   const handleAddSong = async (e: FormEvent) => {
    e.preventDefault();
    if (!songUrl || !user) return;
    if (!activePlaylistId) {
      toast({
        title: "Lütfen önce bir çalma listesi seçin.",
        variant: "destructive"
      });
      return;
    }

    setIsAdding(true);
    
    const addedSong = await addSong({ url: songUrl, title: songUrl }, user.uid, activePlaylistId);

    if (addedSong) {
        toast({ title: `"${addedSong.title}" listenize eklendi.` });
        setSongUrl('');
    }
    
    setIsAdding(false);
  };
  
  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim() || !user) return;
    setIsCreatingPlaylist(true);
    await createPlaylist(newPlaylistName);
    setNewPlaylistName("");
    setIsCreatingPlaylist(false);
  };
  return (
    <div className="p-4 md:p-6 flex flex-col h-full">
         <div className="flex justify-between items-center mb-4 gap-2">
            {userPlaylists && userPlaylists.length > 0 ? (
                <Select value={activePlaylistId || ''} onValueChange={setActivePlaylistId}>
                <SelectTrigger className="flex-grow">
                    <SelectValue placeholder="Çalma Listesi Seç" />
                </SelectTrigger>
                <SelectContent>
                    {userPlaylists.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                </SelectContent>
                </Select>
            ) : (
                <h2 className="text-xl font-semibold flex-grow">Çalma Listem</h2>
            )}
            <Dialog>
                <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="flex-shrink-0"><Plus className="h-4 w-4"/></Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Yeni Çalma Listesi Oluştur</DialogTitle>
                    <DialogDescription>
                    Yeni çalma listeniz için bir isim girin.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Input
                    id="name"
                    placeholder="Örn: Sabah Modu"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                    <Button type="button" onClick={handleCreatePlaylist} disabled={isCreatingPlaylist || !newPlaylistName.trim()}>
                        {isCreatingPlaylist ? <Loader2 className="animate-spin"/> : "Oluştur"}
                    </Button>
                    </DialogClose>
                </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>

        <form id="add-song-form" className="flex mb-4 gap-2" onSubmit={handleAddSong}>
            <Input
            type="url"
            id="song-url-input"
            placeholder="YouTube, SoundCloud veya MP3 linki..."
            required
            value={songUrl}
            onChange={(e) => setSongUrl(e.target.value)}
            className="flex-grow"
            disabled={!activePlaylistId}
            />
            <Button type="submit" id="add-song-button" disabled={isAdding || !activePlaylistId}>
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ekle'}
            </Button>
        </form>
        <div id="playlist-container" className="flex-grow space-y-2">
            {isPlayerLoading ? (
                <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
            ) : !activePlaylistId ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-8">
                <ListMusic className="w-16 h-16 mb-4"/>
                <p className="font-semibold">Başlamak için bir çalma listesi seçin</p>
                <p className="text-sm">Veya yeni bir tane oluşturun.</p>
            </div>
            ) : playlist.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-8">
                <Music className="w-16 h-16 mb-4"/>
                <p className="font-semibold">Çalma listeniz boş</p>
                <p className="text-sm">Yukarıdaki alandan şarkı ekleyin.</p>
            </div>
            ) : (
            playlist.map((song, index) => (
                <PlaylistItem key={song.id} song={song} index={index} isActive={index === currentIndex} onPlay={playSong} onDelete={(songId) => activePlaylistId && deleteSong(songId, activePlaylistId)} />
            ))
            )}
        </div>
    </div>
  )
}

const PlaylistItem = ({ song, index, isActive, onPlay, onDelete }: { song: Song; index: number; isActive: boolean; onPlay: (index: number) => void; onDelete: (id: string) => void; }) => {

  const getSourceText = (type: Song['type']) => {
    switch (type) {
      case 'youtube': return 'YouTube';
      case 'soundcloud': return 'SoundCloud';
      case 'url': return 'URL';
      default: return 'Bilinmeyen';
    }
  }

  return (
    <div className={cn(`playlist-item flex items-center justify-between p-3 rounded-lg cursor-pointer`, {'playing': isActive})} onClick={() => onPlay(index)}>
      <div className="flex items-center flex-grow min-w-0 gap-4">
        {song.videoId ? (
            <Image 
                src={`https://i.ytimg.com/vi/${song.videoId}/default.jpg`}
                alt={song.title}
                width={48}
                height={48}
                className="rounded"
            />
        ) : (
            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                <Music className="w-6 h-6 text-muted-foreground"/>
            </div>
        )}
        <div className="truncate">
          <p className={cn(`font-semibold truncate`, {'text-primary-foreground': isActive})}>{song.title || 'İsimsiz Şarkı'}</p>
          <p className="text-sm text-muted-foreground">{getSourceText(song.type)}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 shrink-0"
        onClick={(e) => { e.stopPropagation(); onDelete(song.id); }}
      >
        <Trash2 className="w-4 h-4"/>
      </Button>
    </div>
  );
};


const CatalogView = ({ setView }: { setView: (view: 'playlist' | 'catalog' | 'search') => void }) => {
  const { addSong, activePlaylistId, userPlaylists } = usePlayer();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState<string | null>(null);

  const songsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'songs'), orderBy('timestamp', 'desc'), limit(50));
  }, [firestore]);

  const { data: catalogSongs, isLoading, error } = useCollection<Song>(songsQuery);

  const handleAddFromCatalog = async (song: Omit<Song, 'id'>) => {
    if (!user) {
      toast({ title: 'Şarkı eklemek için giriş yapmalısınız.', variant: 'destructive' });
      return;
    }
    if (!activePlaylistId) {
       toast({ 
         title: "Lütfen önce bir çalma listesi seçin.",
         description: userPlaylists && userPlaylists.length > 0 ? "Şarkıyı eklemek istediğiniz listeyi 'Listem' sekmesinden seçin." : "Şarkı eklemeden önce yeni bir çalma listesi oluşturun.",
         variant: 'destructive' 
       });
       return;
    }
    setIsAdding(song.videoId || song.url);

    const addedSong = await addSong(song, user.uid, activePlaylistId);
    
    setIsAdding(null);
    if (addedSong) {
      toast({ title: `"${addedSong.title}" listenize eklendi.` });
      setView('playlist');
    }
  };

  const getThumbnailUrl = (song: Song) => {
    if (song.type === 'youtube' && song.videoId) {
      return `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`;
    }
    return `https://i.ytimg.com/vi/default/hqdefault.jpg`;
  }

  return (
    <div id="catalog-view" className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8" id="catalog-content">
        <h2 className="text-3xl font-bold tracking-tight">Müzik Kataloğu</h2>
        
        {isLoading && (
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
             {Array.from({ length: 10 }).map((_, index) => (
               <div key={index} className="p-4 bg-secondary/50 rounded-lg shadow-lg border border-border flex flex-col gap-3 animate-pulse">
                 <div className="aspect-video bg-muted rounded-md"></div>
                 <div className="h-4 bg-muted rounded w-3/4"></div>
                 <div className="h-3 bg-muted rounded w-1/2"></div>
                 <div className="h-8 bg-muted rounded mt-2"></div>
               </div>
             ))}
           </div>
        )}

        {!isLoading && !error && catalogSongs && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {catalogSongs.map((song) => (
              <div key={song.id} className="p-4 bg-secondary/50 rounded-lg shadow-lg border border-border flex flex-col gap-3">
                <Image
                  src={getThumbnailUrl(song)}
                  alt={song.title}
                  width={168}
                  height={94}
                  className="rounded-md aspect-video object-cover w-full"
                />
                <div className="flex-grow">
                  <p className="font-semibold truncate leading-tight text-sm" title={song.title}>{song.title}</p>
                  <p className="text-xs text-muted-foreground">{song.type}</p>
                </div>
                <Button
                  className="w-full mt-2"
                  size="sm"
                  onClick={() => handleAddFromCatalog(song)}
                  disabled={isAdding === (song.videoId || song.url)}
                >
                  {isAdding === (song.videoId || song.url) ? <Loader2 className="animate-spin" /> : <Plus className="w-4 h-4 mr-2"/> }
                   Listeye Ekle
                </Button>
              </div>
            ))}
          </div>
        )}

        {error && (
            <div className="text-center py-10 text-red-400">
                <p>Katalog yüklenirken bir hata oluştu.</p>
                <p className="text-sm text-muted-foreground">{error.message}</p>
            </div>
        )}

        {!isLoading && catalogSongs?.length === 0 && (
             <div className="text-center py-10 text-muted-foreground">
                <Music className="w-16 h-16 mx-auto mb-4"/>
                <p className="font-semibold">Katalogda henüz şarkı yok.</p>
                <p>İlk şarkıyı ekleyen sen ol!</p>
            </div>
        )}
      </div>
    </div>
  );
};

const SearchView = ({ setView }: { setView: (view: 'playlist' | 'catalog' | 'search') => void }) => {
  const { addSong, activePlaylistId, userPlaylists } = usePlayer();
  const { toast } = useToast();
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ songs: { videoId: string; title: string; thumbnailUrl: string; }[] } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults(null);
    try {
      const results = await searchYoutube({ query: searchQuery });
      setSearchResults(results);
      if (results.songs.length === 0) {
        toast({
          title: 'Sonuç bulunamadı',
          description: 'Farklı bir arama terimi deneyin.',
        });
      }
    } catch (error: any) {
      console.error('YouTube arama hatası:', error);
      toast({
        title: 'Arama Başarısız',
        description: error.message || 'Arama sonuçları getirilemedi. Lütfen API anahtarınızı kontrol edin veya daha sonra tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFromSearch = async (videoId: string, title: string) => {
    if (!user) {
      toast({ title: 'Şarkı eklemek için giriş yapmalısınız.', variant: 'destructive' });
      return;
    }
     if (!activePlaylistId) {
       toast({ 
         title: "Lütfen önce bir çalma listesi seçin.",
         description: userPlaylists && userPlaylists.length > 0 ? "Şarkıyı eklemek istediğiniz listeyi 'Listem' sekmesinden seçin." : "Şarkı eklemeden önce yeni bir çalma listesi oluşturun.",
         variant: 'destructive' 
       });
      return;
    }
    setIsAdding(videoId);
    
    const songDetails = {
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: title,
      videoId: videoId,
      type: 'youtube' as const
    };

    const addedSong = await addSong(songDetails, user.uid, activePlaylistId);
    
    setIsAdding(null);
    if (addedSong) {
      toast({ title: `"${title}" listenize eklendi.` });
      setView('playlist');
    }
  };

  return (
    <div id="search-view" className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8" id="search-content">
        <h2 className="text-3xl font-bold tracking-tight">YouTube'da Ara</h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            type="search"
            placeholder="Şarkı, sanatçı, albüm ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-grow"
          />
          <Button type="submit" disabled={isSearching}>
            {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
          </Button>
        </form>

        {isSearching && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
             {Array.from({ length: 4 }).map((_, index) => (
               <div key={index} className="p-4 bg-secondary/50 rounded-lg shadow-lg border border-border flex flex-col gap-3 animate-pulse">
                 <div className="aspect-video bg-muted rounded-md"></div>
                 <div className="h-4 bg-muted rounded w-3/4"></div>
                 <div className="h-8 bg-muted rounded mt-2"></div>
               </div>
             ))}
           </div>
        )}

        {searchResults && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {searchResults.songs.map((song) => (
              <div key={song.videoId} className="p-4 bg-secondary/so50 rounded-lg shadow-lg border border-border flex flex-col gap-3">
                <Image
                  src={song.thumbnailUrl}
                  alt={song.title}
                  width={168}
                  height={94}
                  className="rounded-md aspect-video object-cover w-full"
                />
                <div className="flex-grow">
                   <p className="font-semibold truncate leading-tight text-sm" title={song.title}>{song.title}</p>
                </div>
                <Button
                  className="w-full mt-2"
                  size="sm"
                  onClick={() => handleAddFromSearch(song.videoId, song.title)}
                  disabled={isAdding === song.videoId}
                >
                  {isAdding === song.videoId ? <Loader2 className="animate-spin" /> : <Plus className="w-4 h-4 mr-2"/>}
                  Listeye Ekle
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
