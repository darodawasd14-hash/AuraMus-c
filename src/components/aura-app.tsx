'use client';
import React, { useState, useEffect, FormEvent } from 'react';
import { usePlayer, type Song } from '@/context/player-context';
import { Player } from '@/components/player';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuraLogo, PlayIcon, PauseIcon, SkipBack, SkipForward, Trash2, ListMusic, Music, User as UserIcon, VolumeX, Volume1 } from '@/components/icons';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { signOut, updateProfile } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase/provider';
import { Loader2 } from 'lucide-react';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { ChatPane } from '@/components/chat-pane';

const appId = 'Aura';

interface UserProfile {
  displayName?: string;
}

export function AuraApp() {
  const { playlist, currentIndex, isPlaying, playSong, addSong, deleteSong, togglePlayPause, playNext, playPrev, isLoading } = usePlayer();
  const [songUrl, setSongUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [view, setView] = useState<'player' | 'catalog'>('player');
  const { user } = useUser();
  const firestore = useFirestore();
  const [userProfile, setUserProfile] = useState<UserProfile>({});

  const profileRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'artifacts', appId, 'users', user.uid);
  }, [user, firestore]);

  useEffect(() => {
    if (!profileRef) return;
    const unsubscribe = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      }
    });
    return unsubscribe;
  }, [profileRef]);

  const handleAddSong = async (e: FormEvent) => {
    e.preventDefault();
    if (!songUrl) return;
    setIsAdding(true);
    await addSong(songUrl);
    setSongUrl('');
    setIsAdding(false);
  };

  const currentSong = currentIndex !== -1 ? playlist[currentIndex] : null;

  return (
    <div id="app-container" className="h-screen flex flex-col text-foreground">
      <Header setView={setView} currentView={view} profile={userProfile} />
      <main className="flex-grow overflow-hidden flex flex-row">
        <div id="main-content" className="flex-grow flex flex-col">
          {view === 'player' ? (
            <div id="player-view" className="flex flex-col md:flex-row h-full">
              <div className="w-full md:w-3/5 p-4 md:p-6 flex flex-col justify-center">
                <div className="w-full max-w-3xl mx-auto">
                  <Player song={currentSong} />
                  <div className="mt-6 text-center">
                    <h3 id="current-song-title" className="text-2xl font-bold truncate">
                      {currentSong?.title || 'No Song Selected'}
                    </h3>
                    <p className="text-muted-foreground mt-1">{currentSong?.type === 'youtube' ? 'YouTube' : currentSong?.type === 'soundcloud' ? 'SoundCloud' : '...'}</p>
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
                <h2 className="text-2xl font-semibold mb-4">My Playlist</h2>
                <form id="add-song-form" className="flex mb-4 gap-2" onSubmit={handleAddSong}>
                  <Input
                    type="url"
                    id="song-url-input"
                    placeholder="YouTube or SoundCloud link..."
                    required
                    value={songUrl}
                    onChange={(e) => setSongUrl(e.target.value)}
                    className="flex-grow"
                  />
                  <Button type="submit" id="add-song-button" disabled={isAdding}>
                    {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                  </Button>
                </form>
                <div id="playlist-container" className="flex-grow overflow-y-auto space-y-2 pr-2 -mr-2">
                  {isLoading ? (
                     <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
                  ) : playlist.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                      <Music className="w-16 h-16 mb-4"/>
                      <p className="font-semibold">Your playlist is empty</p>
                      <p className="text-sm">Add songs using the field above.</p>
                    </div>
                  ) : (
                    playlist.map((song, index) => (
                      <PlaylistItem key={song.id} song={song} index={index} isActive={index === currentIndex} onPlay={playSong} onDelete={deleteSong} />
                    ))
                  )}
                </div>
              </aside>
            </div>
          ) : (
            <CatalogView setView={setView} />
          )}
        </div>
        <ChatPane song={currentSong} displayName={userProfile.displayName} />
      </main>
    </div>
  );
}

const Header = ({ setView, currentView, profile }: { setView: (view: 'player' | 'catalog') => void; currentView: 'player' | 'catalog', profile: UserProfile }) => {
  const [isModalOpen, setModalOpen] = useState(false);
  
  return (
    <>
      <header className="flex items-center justify-between p-4 bg-secondary/30 border-b border-border shadow-md backdrop-blur-sm z-10">
        <div className="flex items-center gap-2">
          <AuraLogo className="w-8 h-8" />
          <span className="text-xl font-bold tracking-tight">Aura</span>
        </div>
        <div className="flex items-center p-1 bg-muted/50 rounded-lg border-border">
           <Button onClick={() => setView('player')} variant={currentView === 'player' ? 'secondary' : 'ghost'} size="sm" className="gap-2"> <ListMusic/> My List</Button>
           <Button onClick={() => setView('catalog')} variant={currentView === 'catalog' ? 'secondary' : 'ghost'} size="sm" className="gap-2"> <Music/> Catalog</Button>
        </div>
        <div className="flex items-center gap-4">
          <VolumeControl />
          <Button onClick={() => setModalOpen(true)} variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <UserIcon/>
          </Button>
        </div>
      </header>
      <ProfileModal isOpen={isModalOpen} setIsOpen={setModalOpen} profile={profile} />
    </>
  );
};

const VolumeControl = () => {
  const { isMuted, toggleMute } = usePlayer();

  return (
    <div className="flex items-center gap-2">
      <Button onClick={toggleMute} variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
        {isMuted ? <VolumeX /> : <Volume1 />}
      </Button>
    </div>
  );
};

const PlaylistItem = ({ song, index, isActive, onPlay, onDelete }: { song: Song; index: number; isActive: boolean; onPlay: (index: number) => void; onDelete: (id: string) => void; }) => {
  return (
    <div className={`playlist-item flex items-center justify-between p-3 rounded-lg cursor-pointer ${isActive ? 'playing' : ''}`} onClick={() => onPlay(index)}>
      <div className="flex items-center flex-grow min-w-0 gap-4">
        <span className={`text-xl ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>{song.type === 'youtube' ? '📺' : '☁️'}</span>
        <div className="truncate">
          <p className={`font-semibold ${isActive ? 'text-primary-foreground' : ''}`}>{song.title || 'Untitled Song'}</p>
          <p className="text-sm text-muted-foreground">{song.type === 'youtube' ? 'YouTube' : 'SoundCloud'}</p>
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


const musicCatalog = [
    {
        artist: "Example Artist",
        songs: {
            "YouTube Examples": [
                { title: "Google I/O Keynote", url: "https://www.youtube.com/watch?v=Xnzf_X43mU" },
                { title: "Lofi Girl Radio", url: "https://www.youtube.com/watch?v=jfKfPfyJRdk" }
            ],
            "SoundCloud Examples": [
                { title: "NASA Voyager Golden Record", url: "https://soundcloud.com/nasa/golden-record-sounds-of" },
                { title: "Tame Impala - Let It Happen", url: "https://soundcloud.com/tame-impala/let-it-happen" },
                { title: "Kuzu Kuzu", url: "https://soundcloud.com/user9709537/kuzu-kuzu" },
                { title: "Ma Meilleure Ennemie (English)", url: "https://soundcloud.com/you-know-me-your-dodkdknd/ma-meilleure-ennemie-english" }
            ]
        }
    }
];

const CatalogView = ({ setView }: { setView: (view: 'player' | 'catalog') => void }) => {
  const { addSong } = usePlayer();
  const { toast } = useToast();
  const { user } = useUser();
  const [isAdding, setIsAdding] = useState<string | null>(null);

  const handleAddFromCatalog = async (url: string, title: string) => {
    if (!user) {
      toast({ title: "You must be logged in to add songs.", variant: 'destructive' });
      return;
    }
    setIsAdding(url);
    toast({ title: `Adding "${title}"...` });
    await addSong(url);
    setIsAdding(null);
    setView('player');
  };

  return (
    <div id="catalog-view" className="p-4 md:p-8 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-12" id="catalog-content">
        {musicCatalog.map(artistData => (
          <section key={artistData.artist}>
            <h2 className="text-3xl font-bold tracking-tight border-b-2 border-primary/30 pb-3 mb-6">{artistData.artist}</h2>
            {Object.entries(artistData.songs).map(([mood, songs]) => (
              <div key={mood} className="mb-8">
                <h3 className="text-2xl font-semibold text-primary/80 mb-4">{mood}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {songs.map(song => (
                    <div key={song.url} className="p-4 bg-secondary/50 rounded-lg shadow-lg border border-border flex flex-col gap-4">
                      <p className="font-semibold truncate flex-grow">{song.title}</p>
                      <Button className="w-full" size="sm" onClick={() => handleAddFromCatalog(song.url, song.title)} disabled={isAdding === song.url}>
                        {isAdding === song.url ? <Loader2 className="animate-spin" /> : "Add to Aura"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
};

const ProfileModal = ({ isOpen, setIsOpen, profile }: { isOpen?: boolean; setIsOpen?: (open: boolean) => void; profile: UserProfile }) => {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && profile.displayName) {
      setDisplayName(profile.displayName);
    } else if (isOpen && user?.displayName) {
      setDisplayName(user.displayName);
    }
  }, [isOpen, profile, user]);

  const handleSave = async () => {
    if (!user || !firestore) return;
    const newName = displayName.trim();
    if (!newName) {
      toast({ title: 'Please enter a valid name.', variant: 'destructive' });
      return;
    }
  
    setIsSaving(true);
    const profileRef = doc(firestore, 'artifacts', appId, 'users', user.uid);
    const profileData = { displayName: newName };
  
    try {
      // First update Firestore
      await setDoc(profileRef, profileData, { merge: true });
      
      // Then update Firebase Auth user profile
      if(auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: newName });
      }

      toast({ title: 'Profile saved!' });
      if (setIsOpen) setIsOpen(false);
    } catch (error: any) {
       // This is a generic catch, but we can make the error more specific if needed
       const permissionError = new FirestorePermissionError({
        path: profileRef.path,
        operation: 'update',
        requestResourceData: profileData,
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({ title: 'Error saving profile.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      if (setIsOpen) setIsOpen(false);
      toast({ title: 'Logged out.' });
    } catch (error) {
      console.error("Error logging out:", error);
      toast({ title: 'Failed to log out.', variant: 'destructive' });
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="modal-overlay fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="modal-content w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Profile</h2>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen && setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
            &times;
          </Button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground">Email</label>
            <p className="mt-1 text-lg">{user?.email}</p>
          </div>
          <div>
            <label htmlFor="display-name-input" className="block text-sm font-medium text-muted-foreground">Display Name</label>
            <Input
              type="text"
              id="display-name-input"
              placeholder="Enter your name..."
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Save Changes'}
          </Button>
          <Button onClick={handleLogout} variant="destructive" className="w-full mt-2">
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
};
