'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useRef } from 'react';

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
  seekTo: (time: number) => void; // Allow UI to request a seek

  // Callbacks for the Player component
  _playerSetIsPlaying: (playing: boolean) => void;
  _playerSetProgress: (progress: number) => void;
  _playerSetDuration: (duration: number) => void;
  _playerOnEnd: () => void;
}

export const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

// This type is for the reference to the function that the player will expose
type SeekFunction = (time: number) => void;

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPlayerOpen, setIsPlayerOpen] = useState<boolean>(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const seekRef = useRef<SeekFunction | null>(null);

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
  
  const seekTo = (time: number) => {
    // This is a "request" to seek. The actual seek happens in the Player component.
    // We'll use a ref to pass this function down to the Player.
    // For now, we can update the local progress for a snappy UI response.
    setProgress(time);
    seekRef.current?.(time);
  }

  // Callbacks for the Player component to update the context
  const _playerSetIsPlaying = (playing: boolean) => setIsPlaying(playing);
  const _playerSetProgress = (p: number) => setProgress(p);
  const _playerSetDuration = (d: number) => setDuration(d);
  const _playerOnEnd = () => playNext();


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
    seekTo, // Expose the seek function
    // Pass internal setters to the context
    _playerSetIsPlaying,
    _playerSetProgress,
    _playerSetDuration,
    _playerOnEnd,
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

    