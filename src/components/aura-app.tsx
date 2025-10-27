'use client';
import React, { useState, useEffect, FormEvent, useMemo } from 'react';
import { usePlayer, type Song, type SongDetails } from '@/context/player-context';
import { Player } from '@/components/player';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuraLogo, PlayIcon, PauseIcon, SkipBack, SkipForward, Trash2, ListMusic, Music, User as UserIcon, Search } from '@/components/icons';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { signOut, updateProfile } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase/provider';
import { Loader2 } from 'lucide-react';
import { ChatPane } from '@/components/chat-pane';
import { searchYoutube, type YouTubeSearchOutput } from '@/ai/flows/youtube-search-flow';
import Image from 'next/image';
import { collection, query, orderBy, limit, serverTimestamp, addDoc } from 'firebase/firestore';

const appId = 'Aura';

interface UserProfile {
  displayName?: string;
}

export function AuraApp() {
  const { playlist, currentIndex, isPlaying, playSong, addSong, deleteSong, togglePlayPause, playNext, playPrev, isLoading: isPlayerLoading } = usePlayer();
  const [songUrl, setSongUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [view, setView] = useState<'player' | 'catalog' | 'search'>('player');
  const { user } = useUser();
  const [userProfile, setUserProfile] = useState<UserProfile>({ displayName: user?.displayName || user?.email || undefined });

  useEffect(() => {
    if (user) {
      setUserProfile({ displayName: user.displayName || user.email || undefined });
    }
  }, [user]);

  const handleAddSong = async (e: FormEvent) => {
    e.preventDefault();
    if (!songUrl || !user) return;
    setIsAdding(true);
    await addSong({url: songUrl}, user.uid);
    setSongUrl('');
    setIsAdding(false);
  };

  const currentSong = currentIndex !== -1 ? playlist[currentIndex] : null;

  return (
    <div id="app-container" className="h-screen flex flex-col text-foreground">
      <Header setView={setView} currentView={view} profile={userProfile} setProfile={setUserProfile} />
      <main className="flex-grow overflow-hidden flex flex-row">
        <div id="main-content" className="flex-grow flex flex-col">
          {view === 'player' ? (
            <div id="player-view" className="flex flex-col md:flex-row h-full">
              <div className="w-full md:w-3/5 p-4 md:p-6 flex flex-col justify-center">
                <div className="w-full max-w-3xl mx-auto">
                  <Player song={currentSong} />
                  <div className="mt-6 text-center">
                    <h3 id="current-song-title" className="text-2xl font-bold truncate">
                      {currentSong?.title || 'Şarkı Seçilmedi'}
                    </h3>
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
              <aside className="w-full md:w-2/5 p-4 md:p-6 flex flex-col bg-secondary/30 border-l border-border backdrop-blur-sm">
                <h2 className="text-2xl font-semibold mb-4">Çalma Listem</h2>
                <form id="add-song-form" className="flex mb-4 gap-2" onSubmit={handleAddSong}>
                  <Input
                    type="url"
                    id="song-url-input"
                    placeholder="YouTube, SoundCloud veya MP3 linki..."
                    required
                    value={songUrl}
                    onChange={(e) => setSongUrl(e.target.value)}
                    className="flex-grow"
                  />
                  <Button type="submit" id="add-song-button" disabled={isAdding}>
                    {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ekle'}
                  </Button>
                </form>
                <div id="playlist-container" className="flex-grow overflow-y-auto space-y-2 pr-2 -mr-2">
                  {isPlayerLoading ? (
                     <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
                  ) : playlist.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                      <Music className="w-16 h-16 mb-4"/>
                      <p className="font-semibold">Çalma listeniz boş</p>
                      <p className="text-sm">Yukarıdaki alandan şarkı ekleyin.</p>
                    </div>
                  ) : (
                    playlist.map((song, index) => (
                      <PlaylistItem key={song.id} song={song} index={index} isActive={index === currentIndex} onPlay={playSong} onDelete={deleteSong} />
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
        <ChatPane song={currentSong} displayName={userProfile.displayName} />
      </main>
    </div>
  );
}

const Header = ({ setView, currentView, profile, setProfile }: { setView: (view: 'player' | 'catalog' | 'search') => void; currentView: 'player' | 'catalog' | 'search', profile: UserProfile, setProfile: (profile: UserProfile) => void; }) => {
  const [isModalOpen, setModalOpen] = useState(false);
  
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
          <Button onClick={() => setModalOpen(true)} variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <UserIcon/>
          </Button>
        </div>
      </header>
      <ProfileModal isOpen={isModalOpen} setIsOpen={setModalOpen} profile={profile} setProfile={setProfile} />
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
  const { addSong } = usePlayer();
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
    setIsAdding(song.id);

    const songData: SongDetails = {
      title: song.title,
      url: song.url,
      type: song.type,
      videoId: song.videoId
    };

    await addSong(songData, user.uid);
    
    toast({ title: `"${song.title}" listenize eklendi!` });
    setIsAdding(null);
    setView('player');
  };

  const getThumbnailUrl = (song: Song) => {
    if (song.type === 'youtube' && song.videoId) {
      return `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`;
    }
    return 'https://picsum.photos/seed/1/168/94';
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
                  <p className="text-sm text-muted-foreground truncate">{song.type}</p>
                </div>
                <Button
                  className="w-full mt-2"
                  size="sm"
                  onClick={() => handleAddFromCatalog(song)}
                  disabled={isAdding === song.id}
                >
                  {isAdding === song.id ? <Loader2 className="animate-spin" /> : "Aura'ya Ekle"}
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
  const { addSong } = usePlayer();
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
    setIsAdding(videoId);
    
    // Doğrudan ve basit yaklaşım: Tüm bilinen detayları yolla.
    const songDetails: SongDetails = {
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: title,
      videoId: videoId,
      type: 'youtube'
    };

    await addSong(songDetails, user.uid);
    
    setIsAdding(null);
    toast({ title: `"${title}" listenize eklendi!` });
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
            {Array.from({ length: 5 }).map((_, index) => (
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
                  {isAdding === song.videoId ? <Loader2 className="animate-spin" /> : "Aura'ya Ekle"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


const ProfileModal = ({ isOpen, setIsOpen, profile, setProfile }: { isOpen?: boolean; setIsOpen?: (open: boolean) => void; profile: UserProfile, setProfile: (profile: UserProfile) => void; }) => {
  const { user } = useUser();
  const auth = useAuth();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(profile.displayName || '');
    }
  }, [isOpen, profile]);

  const handleSave = async () => {
    if (!user || !auth.currentUser) return;
    const newName = displayName.trim();
    if (!newName) {
      toast({ title: 'Lütfen geçerli bir isim girin.', variant: 'destructive' });
      return;
    }
  
    setIsSaving(true);
    
    try {
      await updateProfile(auth.currentUser, { displayName: newName });
      setProfile({ displayName: newName });
      
      toast({ title: 'Profil kaydedildi!' });
      if (setIsOpen) setIsOpen(false);
    } catch (error: any) {
      console.error('Profil güncellenirken hata:', error);
      toast({ title: 'Profil kaydedilirken hata oluştu.', variant: 'destructive', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      if (setIsOpen) setIsOpen(false);
      toast({ title: 'Çıkış yapıldı.' });
    } catch (error) {
      console.error("Çıkış yapılırken hata:", error);
      toast({ title: 'Çıkış yapılamadı.', variant: 'destructive' });
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="modal-overlay fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="modal-content w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Profil</h2>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen && setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
            &times;
          </Button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground">E-posta</label>
            <p className="mt-1 text-lg">{user?.email}</p>
          </div>
          <div>
            <label htmlFor="display-name-input" className="block text-sm font-medium text-muted-foreground">Görünen Ad</label>
            <Input
              type="text"
              id="display-name-input"
              placeholder="Adınızı girin..."
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Değişiklikleri Kaydet'}
          </Button>
          <Button onClick={handleLogout} variant="destructive" className="w-full mt-2">
            Çıkış Yap
          </Button>
        </div>
      </div>
    </div>
  );
};
