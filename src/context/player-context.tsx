'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { addDoc, collection, serverTimestamp, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import initialCatalog from '@/app/lib/catalog.json';

export interface Song {
  id: string;
  title: string;
  url: string;
  type: 'youtube' | 'soundcloud' | 'url';
  videoId?: string;
  userId?: string;
  timestamp?: any;
}

export type SongDetails = {
  url: string;
  title: string;
  videoId?: string;
  type: 'youtube' | 'soundcloud' | 'url';
};

type PlayerContextType = {
  playlist: Song[];
  currentSong: Song | null;
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  addSong: (songDetails: SongDetails, userId: string) => Promise<void>;
  deleteSong: (songId: string) => Promise<void>;
  playSong: (index: number) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrev: () => void;
  setYoutubePlayer: (player: any) => void;
  setSoundcloudPlayer: (player: any) => void;
};

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const dataLoadedRef = useRef(false);

  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const youtubePlayerRef = useRef<any>(null);
  const soundcloudPlayerRef = useRef<any>(null);
  const urlPlayerRef = useRef<HTMLAudioElement | null>(null);

  const userPlaylistQuery = useMemoFirebase(() => {
    if (user && firestore) {
      return query(collection(firestore, 'users', user.uid, 'playlist'), orderBy('timestamp', 'asc'));
    }
    return null;
  }, [user, firestore]);

  const { data: userPlaylist, isLoading: isPlaylistLoading } = useCollection<Song>(userPlaylistQuery);
  
  // Effect for handling playlist data from Firestore
  useEffect(() => {
    const isActuallyLoading = isPlaylistLoading || isUserLoading;
    setIsLoading(isActuallyLoading);
    if (isActuallyLoading) return;

    if (userPlaylist) {
      const currentSongId = playlist[currentIndex]?.id;
      setPlaylist(userPlaylist);

      if (userPlaylist.length === 0) {
        setCurrentIndex(-1);
        setIsPlaying(false);
      } else {
        const newIndex = userPlaylist.findIndex(s => s.id === currentSongId);
        if (newIndex !== -1) {
          setCurrentIndex(newIndex);
        } else if (currentIndex >= userPlaylist.length) {
          setCurrentIndex(0);
        }
      }
    } else if (!user) {
      setPlaylist([]);
      setCurrentIndex(-1);
      setIsPlaying(false);
    }
  }, [userPlaylist, isPlaylistLoading, isUserLoading, user]);

  const extractYouTubeID = (url: string): string | null => {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  // Effect for adding initial songs for new users
  useEffect(() => {
    if (firestore && user && !isPlaylistLoading && !dataLoadedRef.current && userPlaylist?.length === 0) {
      dataLoadedRef.current = true;
      const addInitialSongs = async () => {
        try {
          const songsToAdd = initialCatalog.songs;
          for (const song of songsToAdd) {
            const videoId = extractYouTubeID(song.url);
            if (videoId) {
              const songData = {
                url: song.url,
                title: song.title,
                videoId: videoId,
                type: 'youtube' as const,
                userId: user.uid,
                timestamp: serverTimestamp(),
              };
              const userPlaylistRef = collection(firestore, 'users', user.uid, 'playlist');
              await addDoc(userPlaylistRef, songData);
            }
          }
        } catch (error) {
          console.error("Error adding initial songs:", error);
        }
      };
      addInitialSongs();
    }
  }, [firestore, user, isPlaylistLoading, userPlaylist]);


  const addSong = async (songDetails: SongDetails, userId: string) => {
    if (!firestore || !user) {
      toast({ title: 'Şarkı eklemek için giriş yapmalısınız.', variant: 'destructive' });
      return;
    }

    try {
      const userPlaylistRef = collection(firestore, 'users', user.uid, 'playlist');
      const songData = {
        ...songDetails,
        userId: userId,
        timestamp: serverTimestamp(),
      };
      await addDoc(userPlaylistRef, songData);
    } catch (error: any) {
      console.error("Şarkı eklenirken hata:", error);
      toast({ title: error.message || "Şarkı eklenemedi.", variant: 'destructive' });
    }
  };

  const deleteSong = async (songId: string) => {
    if (!firestore || !user) return;

    try {
      const songDocRef = doc(firestore, 'users', user.uid, 'playlist', songId);
      await deleteDoc(songDocRef);
      toast({ title: "Şarkı silindi." });
    } catch (error) {
        console.error("Error deleting song:", error);
        toast({ title: "Şarkı silinirken bir hata oluştu.", variant: 'destructive' });
    }
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
  
  // Unified useEffect for player control. THIS is the source of truth.
  useEffect(() => {
    const song = playlist[currentIndex];
    const youtubePlayer = youtubePlayerRef.current;
    const soundcloudPlayer = soundcloudPlayerRef.current;
    const urlPlayer = urlPlayerRef.current;

    // SCENARIO 1: Stop everything if not playing or no song selected
    if (!isPlaying || !song) {
      if (youtubePlayer && typeof youtubePlayer.pauseVideo === 'function') {
        youtubePlayer.pauseVideo();
      }
      if (soundcloudPlayer && typeof soundcloudPlayer.pause === 'function') {
        soundcloudPlayer.pause();
      }
      if (urlPlayer && !urlPlayer.paused) {
        urlPlayer.pause();
      }
      return;
    }

    // SCENARIO 2: A song should be playing. Play the correct one and pause others.
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
          urlPlayer.play().catch(e => console.error("URL audio playback failed:", e));
        }
        break;
      default:
        // If song type is unknown, pause everything just in case.
        if (youtubePlayer && typeof youtubePlayer.pauseVideo === 'function') youtubePlayer.pauseVideo();
        if (soundcloudPlayer && typeof soundcloudPlayer.pause === 'function') soundcloudPlayer.pause();
        if (urlPlayer && !urlPlayer.paused) urlPlayer.pause();
    }
  }, [isPlaying, currentIndex, playlist]);

  const currentSong = currentIndex > -1 ? playlist[currentIndex] : null;

  const value: PlayerContextType = {
    playlist,
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

    