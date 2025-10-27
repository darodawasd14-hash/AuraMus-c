'use client';
import React, { useState, useEffect, FormEvent } from 'react';
import { usePlayer, type Song } from '@/context/player-context';
import { Player } from '@/components/player';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuraLogo, PlayIcon, PauseIcon, SkipBack, SkipForward, Trash2 } from '@/components/icons';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase/provider';
import { Loader2 } from 'lucide-react';

const appId = 'Aura';

export function AuraApp() {
  const { playlist, currentIndex, isPlaying, playSong, addSong, deleteSong, togglePlayPause, playNext, playPrev, isLoading } = usePlayer();
  const [songUrl, setSongUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [view, setView] = useState<'player' | 'catalog'>('player');

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
    <div id="app-container" className="h-screen bg-gray-900 bg-opacity-50">
      <div className="flex flex-col h-full">
        <Header setView={setView} />
        <main className="flex-grow overflow-y-auto">
          {view === 'player' ? (
            <div id="player-view" className="flex flex-col md:flex-row flex-grow min-h-0 h-full">
              <div className="w-full md:w-3/5 p-4 flex flex-col">
                <Player song={currentSong} />
                <div className="mt-4">
                  <h3 id="current-song-title" className="text-xl font-semibold truncate">
                    {currentSong?.title || '...'}
                  </h3>
                </div>
                <div className="flex items-center justify-center space-x-6 mt-4">
                  <Button id="prev-button" variant="ghost" size="icon" className="p-3 bg-gray-700 rounded-full hover:bg-gray-600" onClick={playPrev}>
                    <SkipBack className="w-6 h-6" />
                  </Button>
                  <Button id="play-pause-button" variant="ghost" size="icon" className="p-4 bg-blue-600 rounded-full hover:bg-blue-700 h-auto w-auto" onClick={togglePlayPause}>
                    {isPlaying ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8" />}
                  </Button>
                  <Button id="next-button" variant="ghost" size="icon" className="p-3 bg-gray-700 rounded-full hover:bg-gray-600" onClick={playNext}>
                    <SkipForward className="w-6 h-6" />
                  </Button>
                </div>
              </div>
              <div className="w-full md:w-2/5 p-4 flex flex-col bg-gray-800 bg-opacity-75 md:border-l border-gray-700 min-h-0 backdrop-filter backdrop-blur-sm">
                <h2 className="text-xl font-semibold mb-3">My Playlist</h2>
                <form id="add-song-form" className="flex mb-3" onSubmit={handleAddSong}>
                  <Input
                    type="url"
                    id="song-url-input"
                    placeholder="YouTube or SoundCloud link..."
                    required
                    value={songUrl}
                    onChange={(e) => setSongUrl(e.target.value)}
                    className="flex-grow px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button type="submit" id="add-song-button" className="px-4 py-2 font-semibold text-white bg-blue-600 rounded-r-md hover:bg-blue-700 transition" disabled={isAdding}>
                    {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                  </Button>
                </form>
                <div id="playlist-container" className="flex-grow overflow-y-auto space-y-2 pr-2">
                  {isLoading ? (
                     <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-blue-400"/></div>
                  ) : playlist.length === 0 ? (
                    <p className="text-gray-500 text-center">Your playlist is empty.</p>
                  ) : (
                    playlist.map((song, index) => (
                      <PlaylistItem key={song.id} song={song} index={index} isActive={index === currentIndex} onPlay={playSong} onDelete={deleteSong} />
                    ))
                  )}
                </div>
                {/* <button id="analyze-playlist-button" className="w-full mt-4 py-2 font-semibold bg-indigo-600 rounded-md hover:bg-indigo-700 transition">Analyze Playlist (Gemini)</button> */}
              </div>
            </div>
          ) : (
            <CatalogView setView={setView} />
          )}
        </main>
      </div>
    </div>
  );
}

const Header = ({ setView }: { setView: (view: 'player' | 'catalog') => void }) => {
  const [isModalOpen, setModalOpen] = useState(false);
  
  return (
    <>
      <header className="flex items-center justify-between p-4 bg-gray-800 bg-opacity-75 shadow-md flex-shrink-0 backdrop-filter backdrop-blur-sm">
        <div className="aura-logo cursor-pointer" onClick={() => setView('catalog')}>
          <AuraLogo className="w-8 h-8 mr-2" />
          <span>Aura Music</span>
        </div>
        <div className="flex items-center space-x-4">
          <Button onClick={() => setView('player')} className="nav-button">My List</Button>
          <Button onClick={() => setModalOpen(true)} className="px-4 py-2 font-semibold bg-gray-700 rounded-lg hover:bg-gray-600 transition">Profile</Button>
        </div>
      </header>
      <ProfileModal isOpen={isModalOpen} setIsOpen={setModalOpen} />
    </>
  );
};

const PlaylistItem = ({ song, index, isActive, onPlay, onDelete }: { song: Song; index: number; isActive: boolean; onPlay: (index: number) => void; onDelete: (id: string) => void; }) => {
  return (
    <div className={`playlist-item flex items-center justify-between p-3 rounded-lg cursor-pointer ${isActive ? 'playing' : ''}`} onClick={() => onPlay(index)}>
      <div className="flex items-center flex-grow min-w-0">
        <span className="mr-3 text-lg">{song.type === 'youtube' ? '📺' : '☁️'}</span>
        <span className="truncate flex-grow">{song.title || 'Untitled Song'}</span>
      </div>
      <button
        className="ml-3 px-2 py-1 text-xs text-red-300 hover:text-white hover:bg-red-600 rounded transition"
        onClick={(e) => { e.stopPropagation(); onDelete(song.id); }}
      >
        <Trash2 className="w-4 h-4"/>
      </button>
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
              { title: "Tame Impala - Let It Happen", url: "https://soundcloud.com/tame-impala/let-it-happen" }
          ]
      }
  }
];

const CatalogView = ({ setView }: { setView: (view: 'player' | 'catalog') => void }) => {
  const { addSong } = usePlayer();
  const { toast } = useToast();
  const { user } = useUser();

  const handleAddFromCatalog = async (url: string) => {
    if (!user) {
      toast({ title: "You must be logged in to add songs.", variant: 'destructive' });
      return;
    }
    toast({ title: "Adding song..." });
    await addSong(url);
    setView('player');
  };

  return (
    <div id="catalog-view" className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8" id="catalog-content">
        {musicCatalog.map(artistData => (
          <section key={artistData.artist}>
            <h2 className="text-3xl font-bold border-b-2 border-blue-500 pb-2 mb-4">{artistData.artist}</h2>
            {Object.entries(artistData.songs).map(([mood, songs]) => (
              <div key={mood} className="mb-6">
                <h3 className="text-xl font-semibold text-blue-300 mb-3">{mood}</h3>
                <ul className="space-y-2">
                  {songs.map(song => (
                    <li key={song.url} className="flex items-center justify-between p-3 bg-gray-800 bg-opacity-75 rounded-lg shadow">
                      <span>{song.title}</span>
                      <Button className="add-button" onClick={() => handleAddFromCatalog(song.url)}>Add to Aura</Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
};

const ProfileModal = ({ isOpen, setIsOpen }: { isOpen?: boolean; setIsOpen?: (open: boolean) => void; }) => {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user || !firestore) return;
    const profileRef = doc(firestore, 'artifacts', appId, 'users', user.uid);
    const unsubscribe = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        setDisplayName(docSnap.data().displayName || '');
      }
    });
    return unsubscribe;
  }, [user, firestore]);

  const handleSave = async () => {
    if (!user || !firestore) return;
    const newName = displayName.trim();
    if (!newName) {
      toast({ title: 'Please enter a valid name.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const profileRef = doc(firestore, 'artifacts', appId, 'users', user.uid);
    try {
      await setDoc(profileRef, { displayName: newName }, { merge: true });
      toast({ title: 'Profile saved!' });
      if (setIsOpen) setIsOpen(false);
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({ title: 'Failed to save profile.', variant: 'destructive' });
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
    <div className="modal fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 backdrop-filter backdrop-blur-sm">
      <div className="modal-content bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 transform">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Profile</h2>
          <button onClick={() => setIsOpen && setIsOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">Email</label>
            <p className="mt-1 text-lg text-white">{user?.email}</p>
          </div>
          <div>
            <label htmlFor="display-name-input" className="block text-sm font-medium text-gray-300">Display Name</label>
            <Input
              type="text"
              id="display-name-input"
              placeholder="Enter your name..."
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Save'}
          </Button>
          <Button onClick={handleLogout} variant="destructive" className="w-full mt-2">
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
};
