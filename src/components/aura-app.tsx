'use client';
import React, { useState, useEffect, FormEvent, useMemo } from 'react';
import { usePlayer } from '@/context/player-context';
import type { Song } from '@/context/player-context';
import { Player } from '@/components/player';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuraLogo, PlayIcon, PauseIcon, SkipBack, SkipForward, Trash2, ListMusic, Music, User as UserIcon, Search, MessageSquare, X, Plus, ChevronDown, Volume2, VolumeX, Maximize2 } from '@/components/icons';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { ChatPane } from '@/components/chat-pane';
import { searchYoutube } from '@/ai/flows/youtube-search-flow';
import Image from 'next/image';
import { collection, query, orderBy, limit, addDoc, serverTimestamp, getDocs, where, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase';
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
import { getYoutubeVideoId } from '@/lib/utils';


export function AuraApp() {
  const { currentSong } = usePlayer();
  const [view, setView] = useState<'playlist' | 'catalog' | 'search'>('playlist');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const { user } = useUser();

  
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
    <div id="app-container" className="relative h-screen w-screen flex flex-col text-foreground bg-background overflow-hidden">
      
      <Player />

      <Header isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} currentView={view} setView={setView} />
      
      <main className="flex-grow flex flex-row overflow-hidden">
        <div className="flex-grow flex flex-col overflow-y-auto pb-20 md:pb-20">
          {view === 'playlist' && <PlaylistView />}
          {view === 'catalog' && <CatalogView setView={setView} />}
          {view === 'search' && <SearchView setView={setView} />}
        </div>
        
        <div className={cn(
          "hidden md:flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out bg-background/50", 
          isChatOpen ? "w-80 border-l border-border" : "w-0 border-l-0"
        )}>
           {user && <ChatPane song={currentSong} />}
        </div>

        {isChatOpen && (
             <div className="md:hidden fixed inset-0 bg-black/60 z-30" onClick={() => setIsChatOpen(false)}>
                <div className="absolute right-0 top-0 h-full w-4/5 max-w-sm bg-background border-l border-border animate-in slide-in-from-right-full duration-300" onClick={e => e.stopPropagation()}>
                    {user && <ChatPane song={currentSong} />}
                </div>
            </div>
        )}
      </main>

       <MiniPlayer />
       <FullPlayerView />
      
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-secondary/50 border-t border-border backdrop-blur-lg z-20 flex justify-around items-center md:hidden">
          <button onClick={() => setView('playlist')} className={cn('nav-button', {'active': view === 'playlist'})}>
            <ListMusic/>
            <span>Listem</span>
          </button>
          <button onClick={() => setView('catalog')} className={cn('nav-button', {'active': view === 'catalog'})}>
            <Music/>
            <span>Katalog</span>
          </button>
          <button onClick={() => setView('search')} className={cn('nav-button', {'active': view === 'search'})}>
            <Search/>
            <span>Ara</span>
          </button>
      </nav>
      
    </div>
  );
}

const Header = ({ isChatOpen, setIsChatOpen, currentView, setView }: { isChatOpen: boolean, setIsChatOpen: (isOpen: boolean) => void, currentView: string, setView: (view: 'playlist' | 'catalog' | 'search') => void }) => {
  const { user } = useUser();
  return (
    <header className="flex items-center justify-between p-4 bg-secondary/30 border-b border-border shadow-md backdrop-blur-sm z-20 flex-shrink-0">
      <div className="flex items-center gap-2">
        <AuraLogo className="w-8 h-8" />
        <span className="text-xl font-bold tracking-tight">Aura</span>
      </div>
      
      <div className="hidden md:flex items-center gap-4">
        <Button variant={currentView === 'playlist' ? 'secondary' : 'ghost'} onClick={() => setView('playlist')} className="rounded-full">Çalma Listem</Button>
        <Button variant={currentView === 'catalog' ? 'secondary' : 'ghost'} onClick={() => setView('catalog')} className="rounded-full">Katalog</Button>
        <Button variant={currentView === 'search' ? 'secondary' : 'ghost'} onClick={() => setView('search')} className="rounded-full">Ara</Button>
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


const PlaylistView = () => {
    const { playlist, currentIndex, playSong, setPlaylist, addSong } = usePlayer();
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useUser();
    const { toast } = useToast();
    const firestore = useFirestore();
    const [songUrl, setSongUrl] = useState('');
    const [isAdding, setIsAdding] = useState(false);


    const handleAddSong = async (e: FormEvent) => {
        e.preventDefault();
        if (!songUrl) return;
        setIsAdding(true);
    
        const videoId = getYoutubeVideoId(songUrl);
    
        if (videoId) {
            let videoTitle = `Yeni Şarkı (${videoId.substring(0, 5)}...)`;
            try {
                const oembedResponse = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
                if (oembedResponse.ok) {
                    const oembedData = await oembedResponse.json();
                    videoTitle = oembedData.title;
                }
            } catch (error) {
                console.error("Could not fetch YouTube video title:", error);
            }
    
            const newSong: Song = {
                id: videoId,
                videoId: videoId,
                title: videoTitle,
                url: `https://www.youtube.com/watch?v=${videoId}`,
                type: 'youtube',
                timestamp: serverTimestamp(),
            };
    
            addSong(newSong);
            toast({ title: `"${videoTitle}" eklendi ve çalınıyor.` });
        } else {
             const safeId = typeof window !== "undefined" ? window.btoa(songUrl).replace(/\//g, '-') : Buffer.from(songUrl).toString('base64').replace(/\//g, '-');
             const newSong: Song = {
                id: safeId,
                url: songUrl,
                title: songUrl,
                type: songUrl.includes('soundcloud.com') ? 'soundcloud' : 'url',
                timestamp: serverTimestamp()
            };
            addSong(newSong);
            toast({ title: `"${newSong.title}" eklendi ve çalınıyor.` });
        }
    
        setSongUrl('');
        setIsAdding(false);
    };

    const handleDeleteSong = (id: string) => {
      const newPlaylist = playlist.filter(song => song.id !== id);
      setPlaylist(newPlaylist);
      toast({ title: 'Şarkı silindi.' });
    };

    return (
        <div className="p-4 md:p-6 flex flex-col h-full">
            <h2 className="text-xl font-semibold flex-grow mb-4">Çalma Listem</h2>

            <form id="add-song-form" className="flex mb-4 gap-2" onSubmit={handleAddSong}>
                <Input
                type="url"
                id="song-url-input"
                placeholder="YouTube veya SoundCloud linki..."
                required
                value={songUrl}
                onChange={(e) => setSongUrl(e.target.value)}
                className="flex-grow"
                />
                <Button type="submit" id="add-song-button" disabled={isAdding}>
                {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ekle'}
                </Button>
            </form>
            <div id="playlist-container" className="flex-grow space-y-2">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
                ) : playlist.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-8">
                    <Music className="w-16 h-16 mb-4"/>
                    <p className="font-semibold">Çalma listeniz boş</p>
                    <p className="text-sm">Yukarıdaki alandan veya katalogdan şarkı ekleyin.</p>
                </div>
                ) : (
                playlist.map((song, index) => (
                    <PlaylistItem key={`${song.id}-${index}`} song={song} index={index} isActive={index === currentIndex} onPlay={() => playSong(song, index)} onDelete={handleDeleteSong} />
                ))
                )}
            </div>
        </div>
    );
};

const PlaylistItem = ({ song, index, isActive, onPlay, onDelete }: { song: Song; index: number; isActive: boolean; onPlay: () => void; onDelete: (id: string) => void; }) => {

  const getSourceText = (type: Song['type']) => {
    switch (type) {
      case 'youtube': return 'YouTube';
      case 'soundcloud': return 'SoundCloud';
      case 'url': return 'URL';
      default: return 'Bilinmeyen';
    }
  }

  return (
    <div className={cn(`playlist-item flex items-center justify-between p-3 rounded-lg cursor-pointer`, {'playing': isActive})} onClick={onPlay}>
      <div className="flex items-center flex-grow min-w-0 gap-4">
        {song.videoId ? (
            <Image 
                src={`https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`}
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
  const { addSong } = usePlayer();
  const { toast } = useToast();
  const firestore = useFirestore();

  const songsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'songs'), orderBy('timestamp', 'desc'), limit(50));
  }, [firestore]);

  const { data: catalogSongs, isLoading, error } = useCollection<Song>(songsQuery);

  const handleAddFromCatalog = async (song: Song) => {
    addSong(song);
    toast({ title: `"${song.title}" listenize eklendi ve çalınıyor.` });
    setView('playlist');
  };

  const getThumbnailUrl = (song: Song) => {
    if (song.type === 'youtube' && song.videoId) {
      return `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`;
    }
    // Fallback for non-youtube songs
    return `https://picsum.photos/seed/${song.id}/168/94`;
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
                >
                   <Plus className="w-4 h-4 mr-2"/>
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

const SearchView = ({ setView }: { setView: (view: 'playlist' | 'catalog' | 'search') => void }) => {
  const { addSong } = usePlayer();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ songs: { videoId: string; title: string; thumbnailUrl: string; }[] } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

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
        description: error.message || 'Arama sonuçları getirilemedi.',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFromSearch = async (videoId: string, title: string) => {
    const songDetails: Song = {
      id: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: title,
      videoId: videoId,
      type: 'youtube'
    };
    
    addSong(songDetails);
    toast({ title: `"${title}" listenize eklendi ve çalınıyor.` });
    setView('playlist');
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
                >
                  <Plus className="w-4 h-4 mr-2"/>
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


function MiniPlayer() {
    const { currentSong, isPlaying, togglePlayPause, playNext, setIsPlayerOpen } = usePlayer();

    if (!currentSong) return null;
    
    const getThumbnailUrl = (song: Song) => {
        if (song.type === 'youtube' && song.videoId) {
            return `https://i.ytimg.com/vi/${song.videoId}/mqdefault.jpg`;
        }
        return `https://picsum.photos/seed/${song.id}/96/96`;
    };

    return (
        <div 
            className={cn(
                "fixed bottom-24 right-4 z-40 flex items-center gap-3 rounded-lg bg-secondary/80 p-3 shadow-2xl backdrop-blur-lg border border-border/50 transition-all duration-300 ease-in-out md:hidden",
                currentSong ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
            )}
        >
            <Image
                src={getThumbnailUrl(currentSong)}
                alt={currentSong.title}
                width={48}
                height={48}
                className="rounded-md aspect-square object-cover"
                onClick={() => setIsPlayerOpen(true)}
            />
            <div className="flex-grow truncate w-36" onClick={() => setIsPlayerOpen(true)}>
                <p className="font-bold truncate text-sm">{currentSong.title}</p>
                <p className="text-xs text-muted-foreground">{currentSong.type}</p>
            </div>
            <div className="flex items-center">
                <Button variant="ghost" size="icon" onClick={togglePlayPause}>
                    {isPlaying ? <PauseIcon className="w-5 h-5"/> : <PlayIcon className="w-5 h-5"/>}
                </Button>
                <Button variant="ghost" size="icon" onClick={playNext}>
                    <SkipForward className="w-5 h-5"/>
                </Button>
                 <Button variant="ghost" size="icon" onClick={() => setIsPlayerOpen(true)}>
                    <Maximize2 className="w-5 h-5"/>
                </Button>
            </div>
        </div>
    );
}

function FullPlayerView() {
  const { 
    currentSong, 
    isPlayerOpen,
    setIsPlayerOpen,
    isPlaying, 
    togglePlayPause, 
    playNext, 
    playPrev,
    progress,
    duration,
    seekTo,
  } = usePlayer();

  const [isSeeking, setIsSeeking] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);

  useEffect(() => {
    if (!isSeeking) {
      setLocalProgress(progress);
    }
  }, [progress, isSeeking]);


  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleProgressChange = (value: number[]) => {
    setLocalProgress(value[0]);
  };

  const handleSeekCommit = (value: number[]) => {
    seekTo(value[0]);
    setIsSeeking(false);
  };
  
  const getThumbnailUrl = (song: Song) => {
    if (song.type === 'youtube' && song.videoId) {
      return `https://i.ytimg.com/vi/${song.videoId}/maxresdefault.jpg`;
    }
    return `https://picsum.photos/seed/${song.id}/640/640`;
  }
  
  if (!currentSong) {
    return null;
  }
  
  if (!isPlayerOpen) {
     return (
        <div className="hidden md:flex fixed bottom-0 left-0 right-0 h-20 bg-secondary/50 border-t border-border backdrop-blur-lg z-20 justify-between items-center px-6">
            <div className="flex items-center gap-4 flex-1 min-w-0">
                <Image
                    src={getThumbnailUrl(currentSong)}
                    alt={currentSong.title}
                    width={56}
                    height={56}
                    className="rounded-md aspect-square object-cover"
                />
                <div className="truncate">
                    <p className="font-bold truncate text-sm">{currentSong.title}</p>
                    <p className="text-xs text-muted-foreground">{currentSong.type}</p>
                </div>
            </div>
            
            <div className="flex flex-col items-center justify-center flex-1 max-w-xl">
                 <div className="flex items-center justify-center gap-4">
                    <Button variant="ghost" size="icon" className="w-10 h-10" onClick={playPrev}>
                        <SkipBack className="w-5 h-5"/>
                    </Button>
                    <Button variant="default" size="icon" className="w-12 h-12" onClick={togglePlayPause}>
                        {isPlaying ? <PauseIcon className="w-6 h-6"/> : <PlayIcon className="w-6 h-6"/>}
                    </Button>
                    <Button variant="ghost" size="icon" className="w-10 h-10" onClick={playNext}>
                        <SkipForward className="w-5 h-5"/>
                    </Button>
                </div>
                 <div className="flex items-center gap-2 w-full mt-1">
                    <span className="text-xs font-mono w-10 text-center">{formatTime(localProgress)}</span>
                    <Slider
                        min={0}
                        max={duration > 0 ? duration : 100}
                        value={[localProgress]}
                        onValueChange={handleProgressChange}
                        onPointerDown={() => setIsSeeking(true)}
                        onValueChangeCommit={handleSeekCommit}
                        className="w-full"
                    />
                    <span className="text-xs font-mono w-10 text-center">{formatTime(duration)}</span>
                </div>
            </div>

            <div className="flex items-center justify-end gap-2 flex-1 min-w-0">
                 <Button variant="ghost" size="icon">
                    <Volume2 className="w-5 h-5"/>
                </Button>
                <Slider
                    min={0}
                    max={1}
                    step={0.01}
                    defaultValue={[0.75]}
                    className="w-24"
                />
                 <Button variant="ghost" size="icon" onClick={() => setIsPlayerOpen(true)}>
                    <Maximize2 className="w-5 h-5"/>
                </Button>
            </div>

        </div>
    )
  }
  
  return (
    <div className={cn(
        "fixed inset-0 bg-background/90 backdrop-blur-2xl z-50 transform-gpu transition-transform duration-500 ease-in-out flex flex-col",
        isPlayerOpen ? "translate-y-0" : "translate-y-full"
    )}>
         <div className="flex-shrink-0 p-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Şimdi Oynatılıyor</h2>
            <Button variant="ghost" size="icon" onClick={() => setIsPlayerOpen(false)}>
                <ChevronDown className="w-6 h-6"/>
            </Button>
        </div>

        <div className="flex-grow flex flex-col items-center justify-center p-8 gap-8">
            <div className="relative w-full max-w-md aspect-square shadow-2xl rounded-lg overflow-hidden">
                 <Image
                    src={getThumbnailUrl(currentSong)}
                    alt={currentSong.title}
                    fill
                    className="object-cover"
                />
            </div>
           
            <div className="w-full max-w-md text-center">
                 <h1 className="text-2xl font-bold">{currentSong.title}</h1>
                 <p className="text-muted-foreground">{currentSong.type}</p>
                 
                 <div className="flex items-center gap-2 mt-6">
                    <span className="text-xs font-mono w-10 text-center">{formatTime(localProgress)}</span>
                    <Slider
                        min={0}
                        max={duration > 0 ? duration : 100}
                        value={[localProgress]}
                        onValueChange={handleProgressChange}
                        onPointerDown={() => setIsSeeking(true)}
                        onValueChangeCommit={handleSeekCommit}
                    />
                    <span className="text-xs font-mono w-10 text-center">{formatTime(duration)}</span>
                </div>

                <div className="flex items-center justify-center gap-4 mt-4">
                    <Button variant="ghost" size="icon" className="w-14 h-14" onClick={playPrev}>
                        <SkipBack className="w-8 h-8"/>
                    </Button>
                    <Button variant="default" size="icon" className="w-20 h-20" onClick={togglePlayPause}>
                        {isPlaying ? <PauseIcon className="w-10 h-10"/> : <PlayIcon className="w-10 h-10"/>}
                    </Button>
                    <Button variant="ghost" size="icon" className="w-14 h-14" onClick={playNext}>
                        <SkipForward className="w-8 h-8"/>
                    </Button>
                </div>
            </div>
           <div className="w-full max-w-xs flex items-center gap-2">
                <Button variant="ghost" size="icon">
                    <Volume2 className="w-5 h-5"/>
                </Button>
                <Slider
                    min={0}
                    max={1}
                    step={0.01}
                    defaultValue={[0.75]}
                />
           </div>
        </div>

    </div>
  )
}
