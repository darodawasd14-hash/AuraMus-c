'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface Song {
  id: string;
  title: string;
  url: string;
  type: 'youtube' | 'soundcloud' | 'url';
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
  setYoutubePlayer: (player: any) => void;
};

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();

  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false); // No longer loading from Firestore
  const youtubePlayerRef = useRef<any>(null);
  
  const currentSong = currentIndex > -1 ? playlist[currentIndex] : null;

  const resetPlayer = () => {
    const youtubePlayer = youtubePlayerRef.current;
    if (youtubePlayer && typeof youtubePlayer.stopVideo === 'function') {
      youtubePlayer.stopVideo();
    }
    setIsPlaying(false);
    setCurrentIndex(-1);
  };

  useEffect(() => {
    const currentSongId = playlist[currentIndex]?.id;
    const newCurrentIndex = playlist.findIndex(song => song.id === currentSongId);
  
    if (currentIndex !== -1 && newCurrentIndex === -1) {
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
    } else if (url.match(/\.(mp3|wav|ogg|m4a)$/) || url.startsWith('http')) {
        const fileName = new URL(url).pathname.split('/').pop() || 'URL Song';
        return {
          title: fileName.replace(/\.[^/.]+$/, ""),
          url: url,
          type: 'url'
        };
    } else {
      throw new Error("Unsupported link type. Please use YouTube, SoundCloud, or a direct audio link.");
    }
  };

  const addSong = async (url: string) => {
    try {
      const songDetails = await getSongDetails(url);
      const newSong: Song = {
        ...songDetails,
        id: new Date().toISOString(), // Use a simple unique ID for in-memory list
        timestamp: new Date()
      };
      setPlaylist(prev => [...prev, newSong]);
      toast({ title: "Song added!" });
    } catch (error: any) {
      console.error("Error adding song:", error);
      toast({ title: error.message || "Failed to add song.", variant: 'destructive' });
    }
  };

  const deleteSong = async (songId: string) => {
    setPlaylist(prev => prev.filter(song => song.id !== songId));
    toast({ title: "Song deleted." });
  };
  
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
    
    setIsPlaying(!isPlaying);
  };

  const playNext = useCallback(() => {
    if (playlist.length === 0) return;
    const nextIndex = (currentIndex + 1) % playlist.length;
    playSong(nextIndex);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, playlist.length]);

  const playPrev = () => {
    if (playlist.length === 0) return;
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playSong(prevIndex);
  };

  const setYoutubePlayer = (player: any) => {
    youtubePlayerRef.current = player;
  };

  useEffect(() => {
    const youtubePlayer = youtubePlayerRef.current;
    const song = playlist[currentIndex];
    
    if (!youtubePlayer || typeof youtubePlayer.playVideo !== 'function') return;

    if (!song || song.type !== 'youtube') {
      return;
    }
    
    if (isPlaying) {
      youtubePlayer.setVolume(100);
      youtubePlayer.playVideo();
    } else {
      youtubePlayer.pauseVideo();
    }
  }, [isPlaying, currentIndex, playlist]);
  

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
