'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, setDoc } from 'firebase/firestore';
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
  volume: number;
  setVolume: (volume: number) => void;
  isMuted: boolean;
  toggleMute: () => void;
  youtubePlayer: any;
  setYoutubePlayer: (player: any) => void;
};

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(80);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(80);
  const [youtubePlayer, setYoutubePlayer] = useState<any>(null);
  
  const songsCollectionRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'artifacts', 'Aura', 'users', user.uid, 'songs');
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
  
  useEffect(() => {
    const currentSongId = playlist[currentIndex]?.id;
    const newCurrentIndex = playlist.findIndex(song => song.id === currentSongId);

    if (currentIndex !== -1 && newCurrentIndex === -1) {
      // Current song was deleted from the playlist
      resetPlayer();
    } else {
      setCurrentIndex(newCurrentIndex);
    }
  }, [playlist, currentIndex]);

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
    setIsPlaying(false);
    setCurrentIndex(-1);
  }
  
  const togglePlayPause = () => {
    if(currentIndex === -1 && playlist.length > 0) {
      setCurrentIndex(0);
      setIsPlaying(true);
    } else if (currentIndex !== -1) {
      setIsPlaying(prev => !prev);
    }
  };
  
  const playSong = useCallback((index: number) => {
    if (index >= 0 && index < playlist.length) {
      if (currentIndex !== index) {
        setCurrentIndex(index);
        setIsPlaying(true);
      } else {
        togglePlayPause();
      }
    } else {
      resetPlayer();
    }
  }, [playlist, currentIndex, togglePlayPause]);

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
  
  const handleSetVolume = (newVolume: number) => {
    if (newVolume > 0) {
      setIsMuted(false);
    } else {
      setIsMuted(true);
    }
    setVolume(newVolume);
  };

  const toggleMute = () => {
    setIsMuted(currentIsMuted => {
      const newMuteState = !currentIsMuted;
      if (newMuteState) {
        setPreviousVolume(volume);
        setVolume(0);
      } else {
        setVolume(previousVolume > 0 ? previousVolume : 80); // Restore to a non-zero volume
      }
      return newMuteState;
    });
  };

  const currentSong = currentIndex !== -1 ? playlist[currentIndex] : null;

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
    volume,
    setVolume: handleSetVolume,
    isMuted,
    toggleMute,
    youtubePlayer,
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
