'use client';
import React, { useState, useEffect, FormEvent, useMemo } from 'react';
import { usePlayer, type Song, type Playlist } from '@/context/player-context';
import { Player } from '@/components/player';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuraLogo, PlayIcon, PauseIcon, SkipBack, SkipForward, Trash2, ListMusic, Music, User as UserIcon, Search, Wand2, MessageSquare, X, Plus } from '@/components/icons';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { signOut, updateProfile } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase/provider';
import { Loader2 } from 'lucide-react';
import { ChatPane } from '@/components/chat-pane';
import { searchYoutube } from '@/ai/flows/youtube-search-flow';
import type { YouTubeSearchOutput } from '@/ai/flows/youtube-search-flow';
import Image from 'next/image';
import { collection, query, orderBy, limit, serverTimestamp, addDoc, getDoc, doc } from 'firebase/firestore';
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

const appId = 'Aura';

interface UserProfile {
  displayName?: string;
}

export function AuraApp() {
  const { 
    playlist, 
    currentIndex, 
    isPlaying, 
    playSong, 
    addSong, 
    deleteSong, 
    togglePlayPause, 
    playNext, 
    playPrev, 
    isLoading: isPlayerLoading,
    userPlaylists,
    activePlaylistId,
    setActivePlaylistId,
    createPlaylist
  } = usePlayer();

  const [songUrl, setSongUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [view, setView] = useState<'player' | 'catalog' | 'search'>('player');
  const { user } = useUser();
  const [userProfile, setUserProfile] = useState<UserProfile>({ displayName: user?.displayName || user?.email || undefined });
  const [backgroundStyle, setBackgroundStyle] = useState({});
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);

  useEffect(() => {
    if (user) {
      setUserProfile({ displayName: user.displayName || user.email || undefined });
    }
  }, [user]);

  const handleAddSong = async (e: FormEvent) => {
    e.preventDefault();
    if (!songUrl || !user || !activePlaylistId) return;
    setIsAdding(true);
    
    let type: 'youtube' | 'soundcloud' | 'url' = 'url';
    let videoId: string | undefined = undefined;

    if (songUrl.includes('youtube.com') || songUrl.includes('youtu.be')) {
        type = 'youtube';
        const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = songUrl.match(regex);
        videoId = match ? match[1] : undefined;
    } else if (songUrl.includes('soundcloud.com')) {
        type = 'soundcloud';
    }

    await addSong({url: songUrl, title: songUrl, type, videoId}, user.uid, activePlaylistId);
    setSongUrl('');
    setIsAdding(false);
  };
  
  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim() || !user) return;
    setIsCreatingPlaylist(true);
    await createPlaylist(newPlaylistName);
    setNewPlaylistName("");
    setIsCreatingPlaylist(false);
    // Dialog should close automatically. You might need a ref or state lift to control Dialog's open prop for this.
    // For simplicity, we'll rely on DialogClose for now.
  };

  const currentSong = currentIndex !== -1 ? playlist[currentIndex] : null;

  return (
    <div id="app-container" className="h-screen flex flex-col text-foreground transition-all duration-1000" style={backgroundStyle}>
      <Header 
        setView={setView} 
        currentView={view} 
        isChatOpen={isChatOpen}
        setIsChatOpen={setIsChatOpen} 
      />
      <main className="flex-grow overflow-hidden flex flex-row">
        <div id="main-content" className={`flex-grow flex flex-col transition-all duration-300 ${isChatOpen ? 'w-[calc(100%-20rem)]' : 'w-full'}`}>
          {view === 'player' ? (
            <div id="player-view" className="flex flex-col md:flex-row h-full">
              <div className="w-full md:w-3/5 p-4 md:p-6 flex flex-col justify-center transition-all duration-300">
                <div className="w-full max-w-3xl mx-auto">
                  <Player song={currentSong} />
                  <div className="mt-6 text-center">
                    <div className="flex justify-center items-center gap-4">
                      <h3 id="current-song-title" className="text-2xl font-bold truncate">
                        {currentSong?.title || 'Şarkı Seçilmedi'}
                      </h3>
                    </div>
                    <p className="text-muted-foreground mt-1">{currentSong?.type === 'youtube' ? 'YouTube' : currentSong?.type === 'soundcloud' ? 'SoundCloud' : currentSong?.type === 'url' ? 'URL' : '...'}</p>
                  </div>
                  <div className="flex items-center justify-center space-x-4 mt-6">
                    <Button id="prev-button" variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={playPrev}>
                      <SkipBack className="w-6 h-6" />
                    </Button>
                    <Button id="play-pause-button" variant="ghost" size="icon" className="bg-primary/20 text-primary-foreground rounded-full w-16 h-16 hover:bg-primary/30" onClick={togglePlayPause}>
                      {isPlaying ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8" />}
                    </Button>
                    <Button id="next-button" variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={playNext}>
                      <SkipForward className="w-6 h-6" />
                    </Button>
                  </div>
                </div>
              </div>
              <aside className="w-full md:w-2/5 p-4 md:p-6 flex flex-col bg-secondary/30 border-l border-border backdrop-blur-sm transition-all duration-300">
                <div className="flex justify-between items-center mb-4">
                    {userPlaylists && userPlaylists.length > 0 ? (
                      <Select value={activePlaylistId || ''} onValueChange={setActivePlaylistId}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Çalma Listesi Seç" />
                        </SelectTrigger>
                        <SelectContent>
                          {userPlaylists.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                       <h2 className="text-2xl font-semibold">Çalma Listem</h2>
                    )}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="icon"><Plus className="h-4 w-4"/></Button>
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
                <div id="playlist-container" className="flex-grow overflow-y-auto space-y-2 pr-2 -mr-2">
                  {isPlayerLoading ? (
                     <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
                  ) : !activePlaylistId ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                      <ListMusic className="w-16 h-16 mb-4"/>
                      <p className="font-semibold">Başlamak için bir çalma listesi seçin</p>
                      <p className="text-sm">Veya yeni bir tane oluşturun.</p>
                    </div>
                  ) : playlist.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                      <Music className="w-16 h-16 mb-4"/>
                      <p className="font-semibold">Çalma listeniz boş</p>
                      <p className="text-sm">Yukarıdaki alandan şarkı ekleyin.</p>
                    </div>
                  ) : (
                    playlist.map((song, index) => (
                      <PlaylistItem key={song.id} song={song} index={index} isActive={index === currentIndex} onPlay={playSong} onDelete={(songId) => deleteSong(songId, activePlaylistId)} />
                    ))
                  )}
                </div>
              </aside>
            </div>
          ) : view === 'catalog' ? (
            <CatalogView setView={setView} />
          ) : (
            <SearchView setView={setView} />
          )}
        </div>
        {isChatOpen && <ChatPane song={currentSong} displayName={userProfile.displayName} />}
      </main>
    </div>
  );
}

const Header = ({ setView, currentView, isChatOpen, setIsChatOpen }: { setView: (view: 'player' | 'catalog' | 'search') => void; currentView: 'player' | 'catalog' | 'search', isChatOpen: boolean; setIsChatOpen: (isOpen: boolean) => void; }) => {
  const { user } = useUser();
  
  return (
    <>
      <header className="flex items-center justify-between p-4 bg-secondary/30 border-b border-border shadow-md backdrop-blur-sm z-10">
        <div className="flex items-center gap-2">
          <AuraLogo className="w-8 h-8" />
          <span className="text-xl font-bold tracking-tight">Aura</span>
        </div>
        <div className="flex items-center p-1 bg-muted/50 rounded-lg border-border">
           <Button onClick={() => setView('player')} variant={currentView === 'player' ? 'secondary' : 'ghost'} size="sm" className="gap-2"> <ListMusic/> Listem</Button>
           <Button onClick={() => setView('catalog')} variant={currentView === 'catalog' ? 'secondary' : 'ghost'} size="sm" className="gap-2"> <Music/> Katalog</Button>
           <Button onClick={() => setView('search')} variant={currentView === 'search' ? 'secondary' : 'ghost'} size="sm" className="gap-2"> <Search/> Ara</Button>
        </div>
        <div className="flex items-center gap-4">
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
    </>
  );
};

const PlaylistItem = ({ song, index, isActive, onPlay, onDelete }: { song: Song; index: number; isActive: boolean; onPlay: (index: number) => void; onDelete: (id: string) => void; }) => {
  const getIcon = (type: Song['type']) => {
    switch (type) {
      case 'youtube': return '📺';
      case 'soundcloud': return '☁️';
      case 'url': return '🎵';
      default: return '🎤';
    }
  }

  const getSourceText = (type: Song['type']) => {
    switch (type) {
      case 'youtube': return 'YouTube';
      case 'soundcloud': return 'SoundCloud';
      case 'url': return 'URL';
      default: return 'Bilinmeyen';
    }
  }

  return (
    <div className={`playlist-item flex items-center justify-between p-3 rounded-lg cursor-pointer ${isActive ? 'playing' : ''}`} onClick={() => onPlay(index)}>
      <div className="flex items-center flex-grow min-w-0 gap-4">
        <span className={`text-xl ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>{getIcon(song.type)}</span>
        <div className="truncate">
          <p className={`font-semibold ${isActive ? 'text-primary-foreground' : ''}`}>{song.title || 'İsimsiz Şarkı'}</p>
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


const CatalogView = ({ setView }: { setView: (view: 'player' | 'catalog' | 'search') => void }) => {
  const { addSong, activePlaylistId } = usePlayer();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState<string | null>(null);

  const songsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'songs'), orderBy('timestamp', 'desc'), limit(50));
  }, [firestore]);

  const { data: catalogSongs, isLoading, error } = useCollection<Song>(songsQuery);

  const handleAddFromCatalog = async (song: Song) => {
    if (!user || !firestore) {
      toast({ title: 'Şarkı eklemek için giriş yapmalısınız.', variant: 'destructive' });
      return;
    }
    if (!activePlaylistId) {
      toast({ title: 'Lütfen önce bir çalma listesi seçin.', variant: 'destructive' });
      return;
    }
    setIsAdding(song.id);

    await addSong(song, user.uid, activePlaylistId);
    
    setIsAdding(null);
    setView('player');
  };

  const getThumbnailUrl = (song: Song) => {
    if (song.type === 'youtube' && song.videoId) {
      return `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`;
    }
    return `https://i.ytimg.com/vi/default/hqdefault.jpg`;
  }

  return (
    <div id="catalog-view" className="p-4 md:p-8 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8" id="catalog-content">
        <h2 className="text-3xl font-bold tracking-tight">Müzik Kataloğu</h2>
        
        {isLoading && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
             {Array.from({ length: 8 }).map((_, index) => (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                  <p className="font-semibold truncate leading-tight" title={song.title}>{song.title}</p>
                  <p className="text-sm text-muted-foreground">{song.type}</p>
                </div>
                <Button
                  className="w-full mt-2"
                  size="sm"
                  onClick={() => handleAddFromCatalog(song)}
                  disabled={isAdding === song.id}
                >
                  {isAdding === song.id ? <Loader2 className="animate-spin" /> : "Listeye Ekle"}
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

const SearchView = ({ setView }: { setView: (view: 'player' | 'catalog' | 'search') => void }) => {
  const { addSong, activePlaylistId } = usePlayer();
  const { toast } = useToast();
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<YouTubeSearchOutput | null>(null);
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
      toast({ title: 'Lütfen önce bir çalma listesi seçin.', variant: 'destructive' });
      return;
    }
    setIsAdding(videoId);
    
    const songDetails = {
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: title,
      videoId: videoId,
      type: 'youtube'
    };

    await addSong(songDetails, user.uid, activePlaylistId);
    
    setIsAdding(null);
    setView('player');
  };

  return (
    <div id="search-view" className="p-4 md:p-8 h-full overflow-y-auto">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="p-4 bg-secondary/50 rounded-lg shadow-lg border border-border flex flex-col gap-3 animate-pulse">
                <div className="aspect-video bg-muted rounded-md"></div>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
                <div className="h-8 bg-muted rounded mt-2"></div>
              </div>
            ))}
          </div>
        )}

        {searchResults && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {searchResults.songs.map((song) => (
              <div key={song.videoId} className="p-4 bg-secondary/50 rounded-lg shadow-lg border border-border flex flex-col gap-3">
                <Image
                  src={song.thumbnailUrl}
                  alt={song.title}
                  width={168}
                  height={94}
                  className="rounded-md aspect-video object-cover w-full"
                />
                <div className="flex-grow">
                   <p className="font-semibold truncate leading-tight" title={song.title}>{song.title}</p>
                </div>
                <Button
                  className="w-full mt-2"
                  size="sm"
                  onClick={() => handleAddFromSearch(song.videoId, song.title)}
                  disabled={isAdding === song.videoId}
                >
                  {isAdding === song.videoId ? <Loader2 className="animate-spin" /> : "Listeye Ekle"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
