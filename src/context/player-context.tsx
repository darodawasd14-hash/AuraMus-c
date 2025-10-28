'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export interface Song {
  id: string;
  title: string;
  url: string;
  type: 'youtube' | 'soundcloud' | 'url';
  videoId?: string;
  timestamp?: any;
}


interface PlayerContextType {
  playlist: Song[];
  currentSong: Song | null;
  currentIndex: number;
  isPlaying: boolean;
  isPlayerOpen: boolean;
  progress: number;
  duration: number;
  
  setPlaylist: (playlist: Song[]) => void;
  playSong: (song: Song, index: number) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrev: () => void;
  setIsPlayerOpen: (isOpen: boolean) => void;

  _setIsPlaying: (playing: boolean) => void;
  _setProgress: (progress: number) => void;
  _setDuration: (duration: number) => void;
}

export const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPlayerOpen, setIsPlayerOpen] = useState<boolean>(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const currentSong = currentIndex > -1 ? playlist[currentIndex] : null;

  const playSong = (song: Song, index: number) => {
    // If it's a new song, always start playing.
    if (currentIndex !== index) {
      setCurrentIndex(index);
      setIsPlaying(true);
    } else {
      // If it's the same song, just toggle.
      togglePlayPause();
    }
  };

  const togglePlayPause = () => {
    if (!currentSong) return;
    setIsPlaying(prev => !prev);
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

  // Internal setters for the player component to report back
  const _setIsPlaying = (playing: boolean) => setIsPlaying(playing);
  const _setProgress = (p: number) => setProgress(p);
  const _setDuration = (d: number) => setDuration(d);

  const value = {
    playlist,
    currentSong,
    currentIndex,
    isPlaying,
    isPlayerOpen,
    progress,
    duration,
    setPlaylist,
    playSong,
    togglePlayPause,
    playNext,
    playPrev,
    setIsPlayerOpen,
    _setIsPlaying,
    _setProgress,
    _setDuration,
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
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
