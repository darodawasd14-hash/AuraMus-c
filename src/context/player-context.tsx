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

interface PlayerControls {
  seek: (time: number) => void;
  unmute: () => void;
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
  seekTo: (time: number) => void;

  _playerSetIsPlaying: (playing: boolean) => void;
  _playerSetProgress: (progress: number) => void;
  _playerSetDuration: (duration: number) => void;
  _playerOnEnd: () => void;
  _playerRegisterControls: (controls: PlayerControls) => void;
}

export const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPlayerOpen, setIsPlayerOpen] = useState<boolean>(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMutedByAutoplay, setIsMutedByAutoplay] = useState(false);

  const playerControlsRef = useRef<PlayerControls | null>(null);

  const currentSong = currentIndex > -1 ? playlist[currentIndex] : null;

  const playSong = (song: Song, index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
    setIsMutedByAutoplay(true); // Assume new song will start muted
    setProgress(0); // Reset progress for new song
    setDuration(0); // Reset duration for new song
  };

  const togglePlayPause = () => {
    if (!currentSong) return;
    
    // First user interaction unmutes the player
    if (isMutedByAutoplay) {
      playerControlsRef.current?.unmute();
      setIsMutedByAutoplay(false);
    }
    
    setIsPlaying(prev => !prev);
  };

  const playNext = useCallback(() => {
    if (playlist.length === 0) return;
    const nextIndex = (currentIndex + 1) % playlist.length;
    playSong(playlist[nextIndex], nextIndex);
  }, [currentIndex, playlist]);

  const playPrev = () => {
    if (playlist.length === 0) return;
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playSong(playlist[prevIndex], prevIndex);
  };
  
  const seekTo = (time: number) => {
    setProgress(time);
    playerControlsRef.current?.seek(time);
  }

  const _playerSetIsPlaying = (playing: boolean) => setIsPlaying(playing);
  const _playerSetProgress = (p: number) => setProgress(p);
  const _playerSetDuration = (d: number) => setDuration(d);
  const _playerOnEnd = () => playNext();
  const _playerRegisterControls = (controls: PlayerControls) => {
    playerControlsRef.current = controls;
  }

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
    seekTo,
    _playerSetIsPlaying,
    _playerSetProgress,
    _playerSetDuration,
    _playerOnEnd,
    _playerRegisterControls,
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
