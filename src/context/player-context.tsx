'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { collection, serverTimestamp, deleteDoc, doc, query, orderBy, getDocs, where, limit, runTransaction, DocumentReference, getDoc, setDoc, addDoc } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import initialCatalog from '@/app/lib/catalog.json';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

export interface Playlist {
  id: string;
  name: string;
  userId: string;
  createdAt: any;
}

export interface Song {
  id: string;
  title: string;
  url: string;
  type: 'youtube' | 'soundcloud' | 'url';
  videoId?: string;
  timestamp?: any;
}

export type SongDetails = Omit<Song, 'id' | 'timestamp'>;

type PlayerContextType = {
  playlist: Song[];
  userPlaylists: Playlist[] | null;
  activePlaylistId: string | null;
  currentSong: Song | null;
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  addSong: (songDetails: SongDetails, userId: string, playlistId: string) => Promise<Song | null>;
  deleteSong: (songId: string, playlistId: string) => Promise<void>;
  playSong: (index: number) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrev: () => void;
  setYoutubePlayer: (player: any) => void;
  setSoundcloudPlayer: (player: any) => void;
  setActivePlaylistId: (id: string | null) => void;
  createPlaylist: (name: string) => Promise<void>;
};

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);

  const youtubePlayerRef = useRef<any>(null);
  const soundcloudPlayerRef = useRef<any>(null);
  const urlPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Fetch user's playlists
  const userPlaylistsQuery = useMemoFirebase(() => {
    if (user && firestore) {
      return query(collection(firestore, 'users', user.uid, 'playlists'), orderBy('createdAt', 'asc'));
    }
    return null;
  }, [user, firestore]);
  const { data: userPlaylists, isLoading: isUserPlaylistsLoading } = useCollection<Playlist>(userPlaylistsQuery);

  // Set initial active playlist
  useEffect(() => {
    if (userPlaylists && userPlaylists.length > 0 && !activePlaylistId) {
      setActivePlaylistId(userPlaylists[0].id);
    } else if (userPlaylists && userPlaylists.length === 0) {
      setActivePlaylistId(null);
    }
  }, [userPlaylists, activePlaylistId]);

  // Fetch songs for the active playlist
  const songsQuery = useMemoFirebase(() => {
    if (user && firestore && activePlaylistId) {
      return query(collection(firestore, 'users', user.uid, 'playlists', activePlaylistId, 'songs'), orderBy('timestamp', 'asc'));
    }
    return null;
  }, [user, firestore, activePlaylistId]);
  const { data: activePlaylistSongs, isLoading: isSongsLoading } = useCollection<Song>(songsQuery);

  // Update local state when Firestore data changes
  useEffect(() => {
    if (activePlaylistSongs) {
      const currentSongId = playlist[currentIndex]?.id;
      setPlaylist(activePlaylistSongs);
      const newIndex = activePlaylistSongs.findIndex(s => s.id === currentSongId);
      
      if (newIndex === -1) { // song not found or list is different
         if (currentIndex !== -1) {
            // Keep playing if possible, or reset
            setCurrentIndex(0); 
         }
      } else {
        setCurrentIndex(newIndex);
      }
      
    } else if (!activePlaylistId) {
      setPlaylist([]);
      setCurrentIndex(-1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlaylistSongs, activePlaylistId]);

  const isLoading = isUserLoading || isUserPlaylistsLoading || isSongsLoading;

  // Function to create a new playlist
  const createPlaylist = async (name: string) => {
    if (!firestore || !user) return;
    const playlistsColRef = collection(firestore, 'users', user.uid, 'playlists');
    const newPlaylist = {
      name,
      userId: user.uid,
      createdAt: serverTimestamp(),
    };
    try {
      const docRef = await addDoc(playlistsColRef, newPlaylist);
      setActivePlaylistId(docRef.id);
      toast({ title: `Çalma listesi "${name}" oluşturuldu.` });
    } catch (error) {
      console.error("Error creating playlist: ", error);
      toast({ title: "Çalma listesi oluşturulamadı.", variant: "destructive" });
    }
  };

  // Create default playlist and add initial songs if no playlists exist
  useEffect(() => {
    if (user && !isUserPlaylistsLoading && userPlaylists?.length === 0) {
      const setupInitialPlaylist = async () => {
        if (!firestore) return;
        
        const defaultPlaylistName = "İlk Çalma Listem";
        const playlistsColRef = collection(firestore, 'users', user.uid, 'playlists');
        const newPlaylistData = {
          name: defaultPlaylistName,
          userId: user.uid,
          createdAt: serverTimestamp(),
        };

        const playlistDocRef = await addDoc(playlistsColRef, newPlaylistData);
        
        for (const song of initialCatalog.songs) {
            const videoId = song.url.split('v=')[1];
            const songDetails: SongDetails = {
                url: song.url,
                title: song.title,
                videoId,
                type: 'youtube'
            };
            await addSong(songDetails, user.uid, playlistDocRef.id);
        }
        toast({ title: "Hoş geldin! Başlangıç için bir çalma listesi ve birkaç şarkı ekledik."});
        setActivePlaylistId(playlistDocRef.id);
      };

      setupInitialPlaylist();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isUserPlaylistsLoading, userPlaylists, firestore]);

  const addSong = async (songDetails: SongDetails, userId: string, playlistId: string): Promise<Song | null> => {
    if (!firestore || !user || !playlistId) {
        toast({ title: 'Şarkı eklemek için bir çalma listesi seçmelisiniz.', variant: 'destructive' });
        return null;
    }

    try {
        const songsCollectionRef = collection(firestore, 'songs');
        const queryIdentifier = songDetails.videoId || songDetails.url;
        const q = query(songsCollectionRef, where(songDetails.videoId ? "videoId" : "url", "==", queryIdentifier), limit(1));
        
        const querySnapshot = await getDocs(q); 
        let centralSongRef: DocumentReference;
        let centralSongData: Song;

        if (querySnapshot.empty) {
            centralSongRef = doc(songsCollectionRef);
            centralSongData = {
                ...songDetails,
                id: centralSongRef.id,
                timestamp: serverTimestamp(),
            };
            await setDoc(centralSongRef, centralSongData);
        } else {
            centralSongRef = querySnapshot.docs[0].ref;
            centralSongData = querySnapshot.docs[0].data() as Song;
        }

        const userPlaylistSongRef = doc(firestore, 'users', userId, 'playlists', playlistId, 'songs', centralSongRef.id);
        const docSnap = await getDoc(userPlaylistSongRef);

        if (docSnap.exists()) {
            toast({
                title: `"${songDetails.title}" zaten bu listede var.`,
                variant: 'default',
            });
            return null;
        } else {
            const songDataForPlaylist = {
                ...centralSongData, 
                timestamp: serverTimestamp()
            };
            await setDoc(userPlaylistSongRef, songDataForPlaylist);

            toast({ title: `"${songDetails.title}" listenize eklendi.` });
            
            return songDataForPlaylist;
        }
       
    } catch (error: any) {
        console.error("Şarkı ekleme sırasında hata: ", error);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `users/${userId}/playlists/${playlistId}/songs`,
            operation: 'create',
            requestResourceData: songDetails
        }));
        toast({
            title: "Şarkı eklenemedi",
            description: "İşlem sırasında bir hata oluştu.",
            variant: "destructive"
        });
        return null;
    }
};

  const deleteSong = async (songId: string, playlistId: string) => {
    if (!firestore || !user || !playlistId) return;
    
    const songDocRef = doc(firestore, 'users', user.uid, 'playlists', playlistId, 'songs', songId);
    
    deleteDoc(songDocRef)
      .then(() => {
        toast({ title: "Şarkı listeden silindi." });
      })
      .catch(serverError => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: songDocRef.path,
            operation: 'delete',
        }));
      });
  };

  const playSong = useCallback((index: number) => {
    if (index >= 0 && index < playlist.length) {
      setCurrentIndex(index);
      setIsPlaying(true);
    } else {
      setCurrentIndex(-1);
      setIsPlaying(false);
    }
  }, [playlist.length]);

  const togglePlayPause = () => {
    if (currentIndex === -1 && playlist.length > 0) {
      playSong(0);
    } else if (playlist.length > 0) {
      setIsPlaying(prev => !prev);
    }
  };

  const playNext = useCallback(() => {
    if (playlist.length === 0) return;
    const nextIndex = (currentIndex + 1) % playlist.length;
    playSong(nextIndex);
  }, [currentIndex, playlist.length, playSong]);

  const playPrev = () => {
    if (playlist.length === 0) return;
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playSong(prevIndex);
  };
  
  useEffect(() => {
    const song = playlist[currentIndex];
    const youtubePlayer = youtubePlayerRef.current;
    const soundcloudPlayer = soundcloudPlayerRef.current;
    const urlPlayer = urlPlayerRef.current;
  
    const pauseAllPlayers = () => {
        if (youtubePlayer && typeof youtubePlayer.pauseVideo === 'function' && typeof youtubePlayer.getPlayerState === 'function') {
            const playerState = youtubePlayer.getPlayerState();
            if (playerState === 1 || playerState === 3) {
              youtubePlayer.pauseVideo();
            }
          }
      if (soundcloudPlayer && typeof soundcloudPlayer.pause === 'function') soundcloudPlayer.pause();
      if (urlPlayer && !urlPlayer.paused) urlPlayer.pause();
    };
  
    if (!isPlaying || !song) {
      pauseAllPlayers();
      return;
    }
  
    switch (song.type) {
      case 'youtube':
        if (soundcloudPlayer && typeof soundcloudPlayer.pause === 'function') soundcloudPlayer.pause();
        if (urlPlayer && !urlPlayer.paused) urlPlayer.pause();
        if (youtubePlayer && typeof youtubePlayer.playVideo === 'function') {
          youtubePlayer.playVideo();
        }
        break;
      case 'soundcloud':
        if (youtubePlayer && typeof youtubePlayer.pauseVideo === 'function') youtubePlayer.pauseVideo();
        if (urlPlayer && !urlPlayer.paused) urlPlayer.pause();
        if (soundcloudPlayer && typeof soundcloudPlayer.play === 'function') {
          soundcloudPlayer.play();
        }
        break;
      case 'url':
        if (youtubePlayer && typeof youtubePlayer.pauseVideo === 'function') youtubePlayer.pauseVideo();
        if (soundcloudPlayer && typeof soundcloudPlayer.pause === 'function') soundcloudPlayer.pause();
        if (urlPlayer) {
          if (urlPlayer.src !== song.url) {
            urlPlayer.src = song.url;
          }
          urlPlayer.play().catch(e => console.error("URL audio playback error:", e));
        }
        break;
      default:
        pauseAllPlayers();
    }
  }, [isPlaying, currentIndex, playlist]);


  const currentSong = currentIndex > -1 ? playlist[currentIndex] : null;

  const value: PlayerContextType = {
    playlist,
    userPlaylists,
    activePlaylistId,
    currentSong,
    currentIndex,
    isPlaying,
    isLoading,
    addSong,
    deleteSong,
    playSong,
    togglePlayPause,
    playNext,
    playPrev,
    setYoutubePlayer: (player: any) => { youtubePlayerRef.current = player; },
    setSoundcloudPlayer: (player: any) => { soundcloudPlayerRef.current = player; },
    setActivePlaylistId,
    createPlaylist,
  };

  return (
    <PlayerContext.Provider value={value}>
      <audio ref={urlPlayerRef} onEnded={playNext} style={{ display: 'none' }} />
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = (): PlayerContextType => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer bir PlayerProvider içinde kullanılmalıdır');
  }
  return context;
};
