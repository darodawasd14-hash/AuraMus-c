'use client';
import React, { useState, useEffect, FormEvent, useMemo, useRef } from 'react';
import { usePlayer } from '@/context/player-context';
import type { Song } from '@/context/player-context';
import { Player } from '@/components/player';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuraLogo, PlayIcon, PauseIcon, SkipBack, SkipForward, Trash2, ListMusic, Music, User as UserIcon, Search, MessageSquare, X, Plus } from '@/components/icons';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { ChatPane } from '@/components/chat-pane';
import { searchYoutube } from '@/ai/flows/youtube-search-flow';
import Image from 'next/image';
import { collection, query, orderBy, limit, serverTimestamp, addDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { getYoutubeVideoId } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import ReactPlayer from 'react-player';


export function AuraApp() {
  const { currentSong, isPlaying } = usePlayer();
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
      
      {/* The single, hidden player that powers the entire app */}
      <Player />

      <div className="flex-grow flex flex-row overflow-hidden">
        <aside className="hidden md:flex flex-col w-64 bg-secondary/30 border-r border-border p-4 space-y-4">
            <div className="flex items-center gap-2 px-2">
                <AuraLogo className="w-8 h-8" />
                <span className="text-xl font-bold tracking-tight">Aura</span>
            </div>
            <nav className="flex flex-col space-y-1">
                <Button variant={view === 'playlist' ? 'secondary' : 'ghost'} onClick={() => setView('playlist')} className="justify-start"><ListMusic className="mr-2"/> Çalma Listem</Button>
                <Button variant={view === 'catalog' ? 'secondary' : 'ghost'} onClick={() => setView('catalog')} className="justify-start"><Music className="mr-2"/> Katalog</Button>
                <Button variant={view === 'search' ? 'secondary' : 'ghost'} onClick={() => setView('search')} className="justify-start"><Search className="mr-2"/> Ara</Button>
            </nav>
        </aside>

        <main className="flex-grow flex flex-col overflow-y-auto pb-24 md:pb-0">
          <Header isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} setView={setView} view={view} />
          <div className="flex-grow">
            {view === 'playlist' && <PlaylistView />}
            {view === 'catalog' && <CatalogView setView={setView} />}
            {view === 'search' && <SearchView setView={setView} />}
          </div>
        </main>
        
        <div className={cn(
          "hidden md:flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out bg-background/50", 
          isChatOpen ? "w-80 border-l border-border" : "w-0 border-l-0"
        )}>
           {user && <ChatPane song={currentSong} />}
        </div>
      </div>
      
      <footer className="fixed bottom-0 left-0 right-0 z-40">
        <PlayerBar />
      </footer>
      
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-secondary/50 border-t border-border backdrop-blur-lg z-20 flex justify-around items-center md:hidden pb-4">
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

const Header = ({ isChatOpen, setIsChatOpen, setView, view }: { isChatOpen: boolean, setIsChatOpen: (isOpen: boolean) => void, setView: (view: 'playlist' | 'catalog' | 'search') => void, view: string }) => {
  const { user } = useUser();
  return (
    <header className="flex items-center justify-between p-4 border-b border-border shadow-sm backdrop-blur-sm z-10 flex-shrink-0">
       <div className="flex items-center gap-2">
         <div className="md:hidden">
            <AuraLogo className="w-8 h-8" />
         </div>
         <nav className="hidden md:flex items-center gap-2">
            <Button variant={view === 'playlist' ? 'secondary' : 'ghost'} onClick={() => setView('playlist')} className="justify-start">Çalma Listem</Button>
            <Button variant={view === 'catalog' ? 'secondary' : 'ghost'} onClick={() => setView('catalog')} className="justify-start">Katalog</Button>
            <Button variant={view === 'search' ? 'secondary' : 'ghost'} onClick={() => setView('search')} className="justify-start">Ara</Button>
        </nav>
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

const PlayerBar = () => {
    const { currentSong, isPlaying, progress, duration, volume, isMuted, togglePlayPause, playNext, playPrevious, seek, setVolume, toggleMute } = usePlayer();

    const formatTime = (seconds: number) => {
        if (isNaN(seconds) || seconds === Infinity) return '0:00';
        const date = new Date(seconds * 1000);
        const hh = date.getUTCHours();
        const mm = date.getUTCMinutes();
        const ss = date.getUTCSeconds().toString().padStart(2, '0');
        if (hh) {
            return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`;
        }
        return `${mm}:${ss}`;
    };

    const handleSeek = (value: number[]) => {
        if (currentSong) {
            seek(value[0]);
        }
    };

    const handleProgressChange = (value: number[]) => {
      if (currentSong) {
        seek(value[0]);
      }
    };

    return (
        <div className="h-24 bg-secondary/80 border-t border-border backdrop-blur-xl p-4 flex items-center gap-4 text-foreground">
            {/* Song Info */}
            <div className="flex items-center gap-3 w-64">
                {currentSong?.artwork ? (
                     <Image src={currentSong.artwork} alt={currentSong.title} width={56} height={56} className="rounded-md" />
                ) : (
                    <div className="w-14 h-14 bg-muted rounded-md flex items-center justify-center">
                        <Music className="w-8 h-8 text-muted-foreground"/>
                    </div>
                )}
                <div>
                    <p className="font-semibold text-sm truncate">{currentSong?.title || 'Şarkı Seçilmedi'}</p>
                    <p className="text-xs text-muted-foreground">{currentSong?.type || 'Kaynak Yok'}</p>
                </div>
            </div>

            {/* Player Controls */}
            <div className="flex-grow flex flex-col items-center gap-2">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={playPrevious} disabled={!currentSong}>
                        <SkipBack className="w-5 h-5"/>
                    </Button>
                    <Button
                        variant="default"
                        size="icon"
                        className="w-12 h-12 rounded-full"
                        onClick={togglePlayPause}
                        disabled={!currentSong}
                    >
                        {isPlaying ? <PauseIcon className="w-5 h-5"/> : <PlayIcon className="w-5 h-5"/>}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={playNext} disabled={!currentSong}>
                        <SkipForward className="w-5 h-5"/>
                    </Button>
                </div>
                <div className="w-full flex items-center gap-2">
                    <span className="text-xs w-12 text-right">{formatTime(progress * duration)}</span>
                    <Slider
                        value={[progress]}
                        max={1}
                        step={0.01}
                        onValueChange={handleProgressChange}
                        className="flex-grow"
                        disabled={!currentSong}
                    />
                    <span className="text-xs w-12">{formatTime(duration)}</span>
                </div>
            </div>

            {/* Volume Controls */}
            <div className="flex items-center gap-2 w-64 justify-end">
                <Button variant="ghost" size="icon" onClick={toggleMute}>
                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5"/> : <Volume2 className="w-5 h-5"/>}
                </Button>
                 <Slider
                    value={[isMuted ? 0 : volume]}
                    max={1}
                    step={0.05}
                    onValueChange={(value) => setVolume(value[0])}
                    className="w-24"
                />
            </div>
        </div>
    );
};

const PlaylistView = () => {
    const { playlist, currentIndex, playSong, setPlaylist, addSong, currentSong, isPlaying, isMuted } = usePlayer();
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const [songUrl, setSongUrl] = useState('');
    const [isAdding, setIsAdding] = useState(false);


    const handleAddSong = async (e: FormEvent) => {
        e.preventDefault();
        if (!songUrl) return;
        setIsAdding(true);
    
        const videoId = getYoutubeVideoId(songUrl);
    
        if (videoId) {
            let videoTitle = `Yeni Şarkı (${videoId.substring(0, 5)}...)`;
            let artwork = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
            try {
                // NOTE: This is a client-side fetch and can be blocked by CORS.
                // A more robust solution would use a server-side API route.
                const oembedResponse = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
                if (oembedResponse.ok) {
                    const oembedData = await oembedResponse.json();
                    videoTitle = oembedData.title;
                    artwork = oembedData.thumbnail_url;
                }
            } catch (error) {
                console.warn("Could not fetch YouTube oEmbed data, using fallback.", error);
            }
    
            const newSong: Song = {
                id: videoId,
                videoId: videoId,
                title: videoTitle,
                url: `https://www.youtube.com/watch?v=${videoId}`,
                type: 'youtube',
                timestamp: serverTimestamp(),
                artwork: artwork,
            };
    
            addSong(newSong);
            toast({ title: `"${videoTitle}" eklendi.` });
        } else if (songUrl.includes('soundcloud.com')) {
             const newSong: Song = {
                id: btoa(songUrl).replace(/\//g, '-'), // Make ID URL-safe
                url: songUrl,
                title: 'SoundCloud Şarkısı',
                type: 'soundcloud',
                timestamp: serverTimestamp()
            };
            addSong(newSong);
            toast({ title: `SoundCloud linki eklendi.` });

        } else {
             toast({ title: `Geçersiz veya desteklenmeyen link.`, variant: 'destructive' });
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
            
            <div className="mb-4 aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
              {currentSong?.type === 'youtube' ? (
                <div className="w-full h-full">
                   <ReactPlayer
                      url={currentSong.url}
                      playing={isPlaying}
                      muted={isMuted} // Sync mute state with context
                      controls={false}
                      width="100%"
                      height="100%"
                      // volume and other props are controlled by the main player
                    />
                </div>
              ) : (
                <div className="text-muted-foreground flex flex-col items-center gap-2">
                  <Music className="w-12 h-12"/>
                  <p>Oynatıcı Alanı</p>
                  <p className="text-xs">Çalan şarkı burada görünecek.</p>
                </div>
              )}
            </div>


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
            <div id="playlist-container" className="flex-grow space-y-2 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
                ) : playlist.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-8 rounded-lg border-2 border-dashed border-border">
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
        {song.artwork ? (
            <Image 
                src={song.artwork}
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
    const songToAdd: Song = {
      ...song,
      artwork: song.videoId ? `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg` : `https://picsum.photos/seed/${song.id}/168/94`,
    }
    addSong(songToAdd);
    toast({ title: `"${song.title}" listenize eklendi.` });
    setView('playlist');
  };

  const getThumbnailUrl = (song: Song) => {
    if (song.type === 'youtube' && song.videoId) {
      return `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`;
    }
    return `https://picsum.photos/seed/${song.id}/168/94`;
  }

  return (
    <div id="catalog-view" className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8" id="catalog-content">
        
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

  const handleAddFromSearch = async (videoId: string, title: string, thumbnailUrl: string) => {
    const songDetails: Song = {
      id: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: title,
      videoId: videoId,
      type: 'youtube',
      artwork: thumbnailUrl
    };
    
    addSong(songDetails);
    toast({ title: `"${title}" listenize eklendi.` });
    setView('playlist');
  };

  return (
    <div id="search-view" className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8" id="search-content">
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
                  onClick={() => handleAddFromSearch(song.videoId, song.title, song.thumbnailUrl)}
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
