'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { collection, serverTimestamp, deleteDoc, doc, query, orderBy, getDocs, where, limit, getDoc, setDoc, addDoc } from 'firebase/firestore';
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

// This context holds the "state" of the player, but not the player logic itself.
type PlayerContextType = {
  // --- Data ---
  playlist: Song[];
  userPlaylists: Playlist[] | null;
  activePlaylistId: string | null;
  currentSong: Song | null;
  currentIndex: number;
  isLoading: boolean;
  
  // --- State ---
  isPlaying: boolean;
  isPlayerOpen: boolean;
  progress: number; // Current playback time in seconds
  duration: number; // Total duration of the song in seconds
  isMuted: boolean;
  volume: number;
  isSeeking: boolean;
  seekTime: number | null; // The time to seek to

  // --- User "Intentions" (Functions to change the state) ---
  addSong: (songDetails: Omit<SongDetails, 'type' | 'videoId'>, userId: string, playlistId: string) => Promise<Song | null>;
  deleteSong: (songId: string, playlistId: string) => Promise<void>;
  playSong: (index: number) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrev: () => void;
  seekTo: (time: number) => void; 
  toggleMute: () => void;
  setVolume: (volume: number) => void;
  setIsSeeking: (isSeeking: boolean) => void;
  setIsPlayerOpen: (isOpen: boolean) => void;
  setActivePlaylistId: (id: string | null) => void;
  createPlaylist: (name: string) => Promise<void>;

  // --- Internal-Only Functions (for the "Motor" to report back to the "Brain") ---
  _setIsPlaying: (isPlaying: boolean) => void;
  _setProgress: (progress: number) => void;
  _setDuration: (duration: number) => void;
  _clearSeek: () => void;
};

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  // --- Data State ---
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);

  // --- Player State ---
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPlayerOpen, setIsPlayerOpen] = useState<boolean>(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(true); // Start muted to comply with autoplay policies
  const [volume, setVolumeState] = useState(0.75); // Volume from 0 to 1
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState<number | null>(null);
  
  // --- Data Fetching ---
  const userPlaylistsQuery = useMemoFirebase(() => {
    if (user && firestore) {
      return query(collection(firestore, 'users', user.uid, 'playlists'), orderBy('createdAt', 'asc'));
    }
    return null;
  }, [user, firestore]);
  const { data: userPlaylists, isLoading: isUserPlaylistsLoading } = useCollection<Playlist>(userPlaylistsQuery);

  // Set the first playlist as active by default
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
  
  const currentSong = currentIndex > -1 ? playlist[currentIndex] : null;
  
  // Sync local playlist state with Firestore data
  useEffect(() => {
    if (activePlaylistSongs) {
      const currentSongId = playlist[currentIndex]?.id;
      setPlaylist(activePlaylistSongs);
      const newIndex = activePlaylistSongs.findIndex(s => s.id === currentSongId);
      
      if (newIndex === -1 && currentIndex !== -1) {
         // If current song was deleted, stop playing
         setIsPlaying(false);
         setCurrentIndex(-1);
      } else {
        setCurrentIndex(newIndex);
      }
      
    } else if (!activePlaylistId) {
      // If no active playlist, clear everything
      setPlaylist([]);
      setCurrentIndex(-1);
      setIsPlaying(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlaylistSongs, activePlaylistId]);

  const isLoading = isUserLoading || isUserPlaylistsLoading || isSongsLoading;

  // --- Playlist/Song Management ---
  const createPlaylist = async (name: string) => {
    if (!firestore || !user) return;
    const playlistsColRef = collection(firestore, 'users', user.uid, 'playlists');
    const newPlaylist = {
      name,
      userId: user.uid,
      createdAt: serverTimestamp(),
    };
    
    addDoc(playlistsColRef, newPlaylist).then(docRef => {
        setActivePlaylistId(docRef.id);
        toast({ title: `Çalma listesi "${name}" oluşturuldu.` });
    }).catch(serverError => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: playlistsColRef.path,
            operation: 'create',
            requestResourceData: newPlaylist,
        }));
    });
  };

  const addSong = async (songInfo: Omit<SongDetails, 'type' | 'videoId'>, userId: string, playlistId: string): Promise<Song | null> => {
    if (!firestore || !user || !playlistId) {
        toast({ title: 'Şarkı eklemek için bir çalma listesi seçmelisiniz.', variant: 'destructive' });
        return null;
    }

    let songDetails: SongDetails;
    const { url } = songInfo;

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regex);
        const videoId = match ? match[1] : undefined;

        if (!videoId) {
            toast({ title: "Geçersiz YouTube linki", description: "Lütfen geçerli bir YouTube video linki girin.", variant: 'destructive' });
            return null;
        }
        songDetails = { ...songInfo, type: 'youtube', videoId };

    } else if (url.includes('soundcloud.com')) {
        songDetails = { ...songInfo, type: 'soundcloud' };
    } else {
        songDetails = { ...songInfo, type: 'url' };
    }

    const songsCollectionRef = collection(firestore, 'songs');
    const queryIdentifier = songDetails.videoId || songDetails.url;
    const queryProperty = songDetails.type === 'youtube' ? "videoId" : "url";
    const q = query(songsCollectionRef, where(queryProperty, "==", queryIdentifier), limit(1));
    
    try {
        const querySnapshot = await getDocs(q); 
        let centralSongRef;

        if (querySnapshot.empty) {
            const newSongId = songDetails.videoId || doc(songsCollectionRef).id;
            centralSongRef = doc(songsCollectionRef, newSongId);
            await setDoc(centralSongRef, { ...songDetails, id: centralSongRef.id, timestamp: serverTimestamp() }, { merge: true });
        } else {
            centralSongRef = querySnapshot.docs[0].ref;
        }

        const userPlaylistSongRef = doc(firestore, 'users', userId, 'playlists', playlistId, 'songs', centralSongRef.id);
        const docSnap = await getDoc(userPlaylistSongRef);

        if (docSnap.exists()) {
            toast({ title: `"${songDetails.title}" zaten bu listede var.` });
            return null;
        } 
        
        const songDataForPlaylist = { ...songDetails, id: centralSongRef.id, timestamp: serverTimestamp() };
        await setDoc(userPlaylistSongRef, songDataForPlaylist);
        return songDataForPlaylist as Song;
    } catch (e: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: e.customData?.path || songsCollectionRef.path,
            operation: e.customData?.operation || 'write',
            requestResourceData: songDetails,
        }));
        toast({ title: 'Şarkı eklenemedi.', description: "İzinler yetersiz olabilir.", variant: 'destructive' });
        return null;
    }
};

  const deleteSong = async (songId: string, playlistId: string) => {
    if (!firestore || !user || !playlistId) return;
    const songDocRef = doc(firestore, 'users', user.uid, 'playlists', playlistId, 'songs', songId);
    await deleteDoc(songDocRef);
    toast({ title: "Şarkı listeden silindi." });
  };
  
  // --- Player Control "Intentions" ---
  const playSong = (index: number) => {
    if (index >= 0 && index < playlist.length) {
      if (index === currentIndex) {
        // If it's the same song, just toggle play/pause
        togglePlayPause();
      } else {
        // If it's a new song, set it and ensure it plays
        setCurrentIndex(index);
        setIsPlaying(true);
      }
    } else {
      // If index is invalid, stop playing
      setCurrentIndex(-1);
      setIsPlaying(false);
    }
  };

  const togglePlayPause = () => {
    if (!currentSong) return;
    setIsPlaying(prev => {
        const newIsPlaying = !prev;
        // If user presses play, also intend to unmute.
        if (newIsPlaying) {
            setIsMuted(false);
        }
        return newIsPlaying;
    });
  };

  const playNext = useCallback(() => {
    if (playlist.length === 0) return;
    const nextIndex = (currentIndex + 1) % playlist.length;
    setCurrentIndex(nextIndex);
    setIsPlaying(true);
  }, [currentIndex, playlist.length]);

  const playPrev = () => {
    if (playlist.length === 0) return;
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    setCurrentIndex(prevIndex);
    setIsPlaying(true);
  };
  
  const seekTo = (time: number) => {
    setSeekTime(time);
    setProgress(time);
  };

  const toggleMute = () => {
      setIsMuted(prev => !prev);
  };

  const setVolume = (vol: number) => {
    setVolumeState(vol);
    if(vol > 0 && isMuted) {
      setIsMuted(false);
    } else if (vol === 0 && !isMuted) {
      setIsMuted(true);
    }
  }
  
  // --- Internal Callbacks for the "Motor" ---
  const _clearSeek = () => setSeekTime(null);
  const _setIsPlaying = (playing: boolean) => setIsPlaying(playing);
  const _setProgress = (p: number) => {
    if (!isSeeking) {
      setProgress(p);
    }
  };
  const _setDuration = (d: number) => setDuration(d);

  // Setup initial playlist for new, non-anonymous users.
  useEffect(() => {
    if (user && !isUserLoading && !isUserPlaylistsLoading && userPlaylists?.length === 0 && !user.isAnonymous) {
      const setupInitialPlaylist = async () => {
        if (!firestore) return;
        const defaultPlaylistName = "İlk Çalma Listem";
        const playlistDocRef = await addDoc(collection(firestore, 'users', user.uid, 'playlists'), {
          name: defaultPlaylistName,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
        
        for (const song of initialCatalog.songs) {
            await addSong(song, user.uid, playlistDocRef.id);
        }
        toast({ title: "Hoş geldin! Başlangıç için bir çalma listesi ve birkaç şarkı ekledik."});
      };
      setupInitialPlaylist().catch(e => {
        console.error("Error setting up initial playlist:", e);
        toast({ title: "Başlangıç çalma listesi oluşturulamadı.", variant: "destructive" });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isUserLoading, isUserPlaylistsLoading, userPlaylists, firestore, toast]);

  const value: PlayerContextType = {
    playlist,
    userPlaylists,
    activePlaylistId,
    currentSong,
    currentIndex,
    isLoading,
    isPlaying,
    isPlayerOpen,
    progress,
    duration,
    isMuted,
    volume,
    isSeeking,
    seekTime,
    
    addSong,
    deleteSong,
    playSong,
    togglePlayPause,
    playNext,
    playPrev,
    seekTo,
    toggleMute,
    setVolume,
    setIsSeeking,
    setIsPlayerOpen,
    setActivePlaylistId,
    createPlaylist,

    _setIsPlaying,
    _setProgress,
    _setDuration,
    _clearSeek,
  };

  return (
    <PlayerContext.Provider value={value}>
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
