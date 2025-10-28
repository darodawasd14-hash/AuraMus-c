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

type PlayerContextType = {
  playlist: Song[];
  userPlaylists: Playlist[] | null;
  activePlaylistId: string | null;
  currentSong: Song | null;
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  isPlayerOpen: boolean;
  progress: number;
  duration: number;
  isSeeking: boolean;
  isMuted: boolean;
  seekTime: number | null;
  
  // User "Intentions"
  addSong: (songDetails: Omit<SongDetails, 'type' | 'videoId'>, userId: string, playlistId: string) => Promise<Song | null>;
  deleteSong: (songId: string, playlistId: string) => Promise<void>;
  playSong: (index: number) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrev: () => void;
  setIsPlayerOpen: (isOpen: boolean) => void;
  setActivePlaylistId: (id: string | null) => void;
  createPlaylist: (name: string) => Promise<void>;
  seekTo: (time: number) => void; 
  toggleMute: () => void;
  setIsSeeking: (isSeeking: boolean) => void;
  
  // Callbacks from the Player Engine
  _setIsPlaying: (isPlaying: boolean) => void;
  _setProgress: (progress: number) => void;
  _setDuration: (duration: number) => void;
  _clearSeek: () => void;
  _setIsMuted: (isMuted: boolean) => void;
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
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekTime, setSeekTime] = useState<number | null>(null);
  const [isSeeking, setIsSeeking] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState(true);
  
  const userPlaylistsQuery = useMemoFirebase(() => {
    if (user && firestore) {
      return query(collection(firestore, 'users', user.uid, 'playlists'), orderBy('createdAt', 'asc'));
    }
    return null;
  }, [user, firestore]);
  const { data: userPlaylists, isLoading: isUserPlaylistsLoading } = useCollection<Playlist>(userPlaylistsQuery);

  useEffect(() => {
    if (userPlaylists && userPlaylists.length > 0 && !activePlaylistId) {
      setActivePlaylistId(userPlaylists[0].id);
    } else if (userPlaylists && userPlaylists.length === 0) {
      setActivePlaylistId(null);
    }
  }, [userPlaylists, activePlaylistId]);

  const songsQuery = useMemoFirebase(() => {
    if (user && firestore && activePlaylistId) {
      return query(collection(firestore, 'users', user.uid, 'playlists', activePlaylistId, 'songs'), orderBy('timestamp', 'asc'));
    }
    return null;
  }, [user, firestore, activePlaylistId]);
  const { data: activePlaylistSongs, isLoading: isSongsLoading } = useCollection<Song>(songsQuery);
  
  const currentSong = currentIndex > -1 ? playlist[currentIndex] : null;
  
  useEffect(() => {
    if (activePlaylistSongs) {
      const currentSongId = playlist[currentIndex]?.id;
      setPlaylist(activePlaylistSongs);
      const newIndex = activePlaylistSongs.findIndex(s => s.id === currentSongId);
      
      if (newIndex === -1 && currentIndex !== -1) {
         setIsPlaying(false);
         setCurrentIndex(-1);
         setProgress(0); 
         setDuration(0); 
      } else {
        setCurrentIndex(newIndex);
      }
      
    } else if (!activePlaylistId) {
      setPlaylist([]);
      setCurrentIndex(-1);
      setIsPlaying(false);
      setProgress(0);
      setDuration(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlaylistSongs, activePlaylistId]);

  const isLoading = isUserLoading || isUserPlaylistsLoading || isSongsLoading;

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
        console.error("Error creating playlist: ", serverError);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: playlistsColRef.path,
            operation: 'create',
            requestResourceData: newPlaylist,
        }));
    });
  };

  useEffect(() => {
    if (user && !isUserLoading && !isUserPlaylistsLoading && userPlaylists?.length === 0) {
      const setupInitialPlaylist = async () => {
        if (!firestore) return;
        
        const defaultPlaylistName = "İlk Çalma Listem";
        const playlistsColRef = collection(firestore, 'users', user.uid, 'playlists');
        const newPlaylistData = {
          name: defaultPlaylistName,
          userId: user.uid,
          createdAt: serverTimestamp(),
        };

        try {
            const playlistDocRef = await addDoc(playlistsColRef, newPlaylistData);
            
            for (const song of initialCatalog.songs) {
                const videoId = song.url.split('v=')[1];
                const songDetails: SongDetails = {
                    url: song.url,
                    title: song.title,
                    videoId,
                    type: 'youtube'
                };
                const centralSongRef = doc(collection(firestore, 'songs'), videoId || song.id);
                await setDoc(centralSongRef, { ...songDetails, id: centralSongRef.id, timestamp: serverTimestamp() }, { merge: true });
                
                const userPlaylistSongRef = doc(firestore, 'users', user.uid, 'playlists', playlistDocRef.id, 'songs', centralSongRef.id);
                await setDoc(userPlaylistSongRef, { ...songDetails, id: centralSongRef.id, timestamp: serverTimestamp() });
            }
            toast({ title: "Hoş geldin! Başlangıç için bir çalma listesi ve birkaç şarkı ekledik."});
        } catch(e: any) {
             const path = e.customData?.path || playlistsColRef.path;
             const operation = e.customData?.operation || 'create';
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: path,
                operation: operation,
                requestResourceData: newPlaylistData,
            }));
             toast({ title: "Başlangıç çalma listesi oluşturulamadı.", description: e.message, variant: "destructive" });
        }
      };

      if (!user.isAnonymous) {
          setupInitialPlaylist();
      }
    }
  }, [user, isUserLoading, isUserPlaylistsLoading, userPlaylists, firestore, toast]);

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
            await setDoc(centralSongRef, {
                ...songDetails,
                id: centralSongRef.id,
                timestamp: serverTimestamp(),
            });
        } else {
            centralSongRef = querySnapshot.docs[0].ref;
        }

        const userPlaylistSongRef = doc(firestore, 'users', userId, 'playlists', playlistId, 'songs', centralSongRef.id);
        const docSnap = await getDoc(userPlaylistSongRef);

        if (docSnap.exists()) {
            toast({
                title: `"${songDetails.title}" zaten bu listede var.`,
                variant: 'default',
            });
            return null;
        } 
        
        const songDataForPlaylist = {
            ...songDetails,
            id: centralSongRef.id,
            timestamp: serverTimestamp()
        };

        await setDoc(userPlaylistSongRef, songDataForPlaylist).catch(serverError => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: userPlaylistSongRef.path,
                operation: 'create',
                requestResourceData: songDataForPlaylist,
            }));
        });

        return songDataForPlaylist as Song;

    } catch (serverError: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: songsCollectionRef.path,
            operation: 'write',
            requestResourceData: songDetails,
        }));
        toast({ title: 'Şarkı eklenemedi.', description: "İzinler yetersiz olabilir.", variant: 'destructive'});
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
  
  const playSong = (index: number) => {
    if (index >= 0 && index < playlist.length) {
      // If the same song is clicked, toggle play/pause
      if (index === currentIndex) {
        togglePlayPause();
      } else {
        // If a new song is clicked, play it
        setCurrentIndex(index);
        setIsPlaying(true);
        // If the player starts muted by default, unmute it on first play
        if(isMuted) {
          setIsMuted(false);
        }
      }
    } else {
      // If index is invalid, stop playing
      setCurrentIndex(-1);
      setIsPlaying(false);
    }
  };

  const togglePlayPause = () => {
    if (!currentSong) return;
    // If it's muted, the first action is to unmute.
    if (isMuted) {
      setIsMuted(false);
    }
    // Then toggle the playing state.
    setIsPlaying(prev => !prev);
  };

  const toggleMute = () => {
    setIsMuted(prev => !prev);
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
  };
  
  const _clearSeek = () => {
      setSeekTime(null);
  }

  const value: PlayerContextType = {
    playlist,
    userPlaylists,
    activePlaylistId,
    currentSong,
    currentIndex,
    isPlaying,
    isLoading,
    isPlayerOpen,
    progress,
    duration,
    isSeeking,
    isMuted,
    seekTime,
    
    addSong,
    deleteSong,
    playSong,
    togglePlayPause,
    playNext,
    playPrev,
    setIsPlayerOpen,
    setActivePlaylistId,
    createPlaylist,
    seekTo,
toggleMute,
    setIsSeeking,

    _setIsPlaying: setIsPlaying,
    _setProgress: setProgress,
    _setDuration: setDuration,
    _clearSeek,
    _setIsMuted: setIsMuted,
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
