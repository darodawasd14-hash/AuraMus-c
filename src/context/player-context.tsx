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
  isPlayerOpen: boolean;
  youtubePlayer: any;
  soundcloudPlayer: any;
  urlPlayer: HTMLAudioElement | null;
  addSong: (songDetails: Omit<SongDetails, 'type' | 'videoId'>, userId: string, playlistId: string) => Promise<Song | null>;
  deleteSong: (songId: string, playlistId: string) => Promise<void>;
  playSong: (index: number) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrev: () => void;
  setIsPlayerOpen: (isOpen: boolean) => void;
  setYoutubePlayer: (player: any) => void;
  setSoundcloudPlayer: (player: any) => void;
  setUrlPlayer: (player: HTMLAudioElement | null) => void;
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
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  const [youtubePlayer, setYoutubePlayer] = useState<any>(null);
  const [soundcloudPlayer, setSoundcloudPlayer] = useState<any>(null);
  const [urlPlayer, setUrlPlayer] = useState<HTMLAudioElement | null>(null);


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

  // Create default playlist and add initial songs if no playlists exist
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isUserLoading, isUserPlaylistsLoading, userPlaylists, firestore]);

  const addSong = async (songInfo: Omit<SongDetails, 'type' | 'videoId'>, userId: string, playlistId: string): Promise<Song | null> => {
    if (!firestore || !user || !playlistId) {
        toast({ title: 'Şarkı eklemek için bir çalma listesi seçmelisiniz.', variant: 'destructive' });
        return null;
    }

    let songDetails: SongDetails;
    const { url } = songInfo;

    // Determine type and extract videoId
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
    // Use a specific property for querying, depending on the song type
    const queryProperty = songDetails.type === 'youtube' ? "videoId" : "url";
    const q = query(songsCollectionRef, where(queryProperty, "==", queryIdentifier), limit(1));
    
    try {
        const querySnapshot = await getDocs(q); 
        let centralSongRef: DocumentReference;
        let centralSongData: Song;

        if (querySnapshot.empty) {
            // Use videoId for YouTube songs as document ID for easy lookup, otherwise generate a new one
            const newSongId = songDetails.videoId || doc(songsCollectionRef).id;
            centralSongRef = doc(songsCollectionRef, newSongId);
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
        } 

        const songDataForPlaylist = {
            ...centralSongData, 
            timestamp: serverTimestamp()
        };
        
        await setDoc(userPlaylistSongRef, songDataForPlaylist).catch(serverError => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: userPlaylistSongRef.path,
                operation: 'create',
                requestResourceData: songDataForPlaylist,
            }));
        });

        return songDataForPlaylist;

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

  const playSong = useCallback((index: number) => {
    if (index >= 0 && index < playlist.length) {
      setCurrentIndex(index);
      setIsPlaying(true);
      setIsPlayerOpen(true);
    } else {
      setCurrentIndex(-1);
      setIsPlaying(false);
      setIsPlayerOpen(false);
    }
  }, [playlist.length]);

  const togglePlayPause = () => {
    if (currentIndex === -1 && playlist.length > 0) {
      playSong(0);
      return;
    }
    
    setIsPlaying(prevIsPlaying => {
      const newIsPlaying = !prevIsPlaying;
      const song = playlist[currentIndex];
  
      if (!song) return prevIsPlaying; // No song, do nothing

      if (newIsPlaying) {
        if (song.type === 'youtube' && youtubePlayer) {
          youtubePlayer.playVideo();
        } else if (song.type === 'soundcloud' && soundcloudPlayer) {
          soundcloudPlayer.play();
        } else if (song.type === 'url' && urlPlayer) {
          if (urlPlayer.src !== song.url) {
            urlPlayer.src = song.url;
          }
          urlPlayer.play().catch(e => console.error("URL audio playback error:", e));
        }
      } else { // Pausing
        if (song.type === 'youtube' && youtubePlayer) {
          youtubePlayer.pauseVideo();
        } else if (song.type === 'soundcloud' && soundcloudPlayer) {
          soundcloudPlayer.pause();
        } else if (song.type === 'url' && urlPlayer) {
          if (!urlPlayer.paused) {
            urlPlayer.pause();
          }
        }
      }
      
      if (!isPlayerOpen && newIsPlaying) {
        setIsPlayerOpen(true);
      }

      return newIsPlaying;
    });
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
  
  const currentSong = currentIndex > -1 ? playlist[currentIndex] : null;

  const value: PlayerContextType = {
    playlist,
    userPlaylists,
    activePlaylistId,
    currentSong,
    currentIndex,
    isPlaying,
    isLoading,
    isPlayerOpen,
    youtubePlayer,
    soundcloudPlayer,
    urlPlayer,
    addSong,
    deleteSong,
    playSong,
    togglePlayPause,
    playNext,
    playPrev,
    setIsPlayerOpen,
    setYoutubePlayer,
    setSoundcloudPlayer,
    setUrlPlayer,
    setActivePlaylistId,
    createPlaylist,
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
