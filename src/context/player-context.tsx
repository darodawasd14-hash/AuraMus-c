'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

export interface Song {
  id: string;
  title: string;
  url: string;
  type: 'youtube' | 'soundcloud';
  videoId?: string;
  timestamp?: any;
}

type PlayerContextType = {
  playlist: Song[];
  currentSong: Song | null;
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  addSong: (url: string) => Promise<void>;
  deleteSong: (songId: string) => Promise<void>;
  playSong: (index: number) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrev: () => void;
  isMuted: boolean;
  toggleMute: () => void;
  setYoutubePlayer: (player: any) => void;
};

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const appId = 'Aura';

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState(false);
  const youtubePlayerRef = useRef<any>(null);
  
  const songsCollectionRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'artifacts', appId, 'users', user.uid, 'songs');
  }, [user, firestore]);

  useEffect(() => {
    if (!songsCollectionRef) {
      setPlaylist([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const q = query(songsCollectionRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const serverPlaylist: Song[] = [];
        snapshot.forEach((doc) => {
          serverPlaylist.push({ id: doc.id, ...doc.data() } as Song);
        });

        setPlaylist(serverPlaylist);
        setIsLoading(false);
      },
      (error) => {
        const contextualError = new FirestorePermissionError({
          path: songsCollectionRef.path,
          operation: 'list',
        });
        errorEmitter.emit('permission-error', contextualError);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [songsCollectionRef]);
  
  const currentSong = currentIndex > -1 ? playlist[currentIndex] : null;

  useEffect(() => {
    const youtubePlayer = youtubePlayerRef.current;
    if (youtubePlayer && typeof youtubePlayer.setVolume === 'function') {
      youtubePlayer.setVolume(isMuted ? 0 : 80);
    }
  }, [isMuted]);

  useEffect(() => {
    const currentSongId = playlist[currentIndex]?.id;
    const newCurrentIndex = playlist.findIndex(song => song.id === currentSongId);
  
    if (currentIndex !== -1 && newCurrentIndex === -1) {
      // Current song was deleted from the playlist
      resetPlayer();
    } else {
      setCurrentIndex(newCurrentIndex);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist]);

  const extractYouTubeID = (url: string): string | null => {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const getSongDetails = async (url: string): Promise<Omit<Song, 'id' | 'timestamp'>> => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = extractYouTubeID(url);
      if (!videoId) throw new Error("Invalid YouTube link.");
      const canonicalYouTubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const oembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(canonicalYouTubeUrl)}`;
      const response = await fetch(oembedUrl);
      if (!response.ok) return { title: `YouTube: ${videoId}`, url: canonicalYouTubeUrl, type: 'youtube', videoId: videoId };
      const data = await response.json();
      if (data.error) return { title: `YouTube: ${videoId}`, url: canonicalYouTubeUrl, type: 'youtube', videoId: videoId };
      return {
        title: data.title || `YouTube: ${videoId}`,
        url: canonicalYouTubeUrl,
        type: 'youtube',
        videoId: videoId
      };
    } else if (url.includes('soundcloud.com')) {
      const urlParts = url.split('?');
      const cleanUrl = urlParts[0];
      const oembedUrl = `https://soundcloud.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
      const response = await fetch(oembedUrl);
      if (!response.ok) throw new Error("Invalid or private SoundCloud link.");
      const data = await response.json();
      if (!data.title) throw new Error("Could not retrieve SoundCloud song title.");
      return {
        title: data.title,
        url: cleanUrl,
        type: 'soundcloud'
      };
    } else {
      throw new Error("Only YouTube and SoundCloud links are supported.");
    }
  };

  const addSong = async (url: string) => {
    if (!songsCollectionRef) {
      toast({ title: "You must be logged in to add songs.", variant: 'destructive' });
      return;
    }
    try {
      const songData = await getSongDetails(url);
      const fullSongData = { ...songData, timestamp: serverTimestamp() };
      
      addDoc(songsCollectionRef, fullSongData)
        .then(() => {
            toast({ title: "Song added!" });
        })
        .catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: songsCollectionRef.path,
                operation: 'create',
                requestResourceData: fullSongData,
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ title: "Error adding song.", variant: 'destructive' });
        });

    } catch (error: any) {
      console.error("Error adding song:", error);
      toast({ title: error.message || "Failed to add song.", variant: 'destructive' });
    }
  };

  const deleteSong = async (songId: string) => {
    if (!user || !firestore) return;
    const songRef = doc(firestore, 'artifacts', 'Aura', 'users', user.uid, 'songs', songId);

    deleteDoc(songRef)
      .then(() => {
          toast({ title: "Song deleted." });
      })
      .catch((serverError) => {
          const permissionError = new FirestorePermissionError({
              path: songRef.path,
              operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
          toast({ title: 'Error deleting song.', variant: 'destructive' });
      });
  };
  
  const resetPlayer = () => {
    const youtubePlayer = youtubePlayerRef.current;
    if (youtubePlayer && typeof youtubePlayer.stopVideo === 'function') {
      youtubePlayer.stopVideo();
    }
    setIsPlaying(false);
    setCurrentIndex(-1);
  }
  
  const playSong = (index: number) => {
    if (index >= 0 && index < playlist.length) {
      setCurrentIndex(index);
      setIsPlaying(true);
    } else {
      resetPlayer();
    }
  };
  
  const togglePlayPause = () => {
    if (currentIndex === -1 && playlist.length > 0) {
      playSong(0);
      return;
    }
    
    setIsPlaying(prevIsPlaying => !prevIsPlaying);
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

  const toggleMute = () => {
    setIsMuted(currentIsMuted => !currentIsMuted);
  };

  const setYoutubePlayer = (player: any) => {
    youtubePlayerRef.current = player;
  };

  useEffect(() => {
    const youtubePlayer = youtubePlayerRef.current;
    if (youtubePlayer && typeof youtubePlayer.playVideo === 'function' && currentSong?.type === 'youtube') {
      if (isPlaying) {
        youtubePlayer.playVideo();
      } else {
        youtubePlayer.pauseVideo();
      }
    }
  }, [isPlaying, currentSong, currentIndex]);


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
    isMuted,
    toggleMute,
    setYoutubePlayer,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};

export const usePlayer = (): PlayerContextType => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
