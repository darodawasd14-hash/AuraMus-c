'use client';
import React, { createContext, useState, useContext, ReactNode, useCallback, useRef } from 'react';
import type { OnProgressProps } from 'react-player/base';
import type ReactPlayer from 'react-player';

export interface Song { 
  id: string;
  videoId?: string;
  title: string;
  url: string;
  type: 'youtube' | 'soundcloud' | 'url';
  timestamp?: any;
  artwork?: string; // Küçük resim için
}

interface PlayerContextType {
  // Oynatıcı Durumu
  currentSong: Song | null;
  isPlaying: boolean;
  isReady: boolean;
  hasInteracted: boolean; // Tarayıcı izni için
  
  // Çalma Listesi Durumu
  playlist: Song[];
  currentIndex: number;
  
  // Zaman Durumu
  progress: number; // 0-1 arası
  duration: number; // saniye

  // Ses Durumu
  volume: number; // 0-1 arası
  isMuted: boolean;

  // Kontrol Referansı
  playerRef: React.RefObject<ReactPlayer> | null;

  // Temel Kontroller
  playSong: (song: Song, index: number) => void;
  togglePlayPause: () => void;
  addSong: (song: Song) => void;
  setPlaylist: (playlist: Song[]) => void;
  playNext: () => void;
  playPrevious: () => void;
  
  // Ses Kontrolleri
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  activateSound: () => void;

  // İlerleme Kontrolü
  seek: (progress: number) => void;

  // Dahili Oynatıcı Raporlama Fonksiyonları (Dışarıdan kullanılmamalı)
  _playerOnReady: () => void;
  _playerOnProgress: (data: OnProgressProps) => void;
  _playerOnDuration: (duration: number) => void;
  _playerOnEnded: () => void;
  _playerOnPlay: () => void;
  _playerOnPause: () => void;
}

export const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  // Oynatıcı Durumu
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);

  // Çalma Listesi
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  // Zaman
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Ses
  const [volume, setVolumeState] = useState(0.8);
  const [isMuted, setIsMuted] = useState(true); // Always start muted
  
  const playerRef = useRef<ReactPlayer>(null);

  const activateSound = useCallback(() => {
    if (!hasInteracted) {
      console.log("Interaction detected, activating sound.");
      setHasInteracted(true);
      // Unmute and ensure playback
      setIsMuted(false);
      if (playerRef.current && !isPlaying) {
          setIsPlaying(true);
      }
    }
  }, [hasInteracted, isPlaying]);

  const playSong = (song: Song, index: number) => {
    setCurrentSong(song);
    setCurrentIndex(index);
    setProgress(0);
    setDuration(0);
    setIsPlaying(true); // Attempt to play automatically
    setIsReady(false); // Player is not ready until the new song loads
    
    // Only unmute if user has already interacted with the site
    if (hasInteracted) {
        setIsMuted(false);
    } else {
        setIsMuted(true);
    }
  };
  
  const togglePlayPause = () => {
    if (!isReady || !currentSong) return;

    if (!hasInteracted) {
        activateSound();
        return; // Let activateSound handle starting playback
    }

    setIsPlaying(prev => !prev);
  };

  const addSong = (song: Song) => {
    const newPlaylist = [...playlist, song];
    setPlaylist(newPlaylist);
    if (!currentSong) {
      playSong(song, newPlaylist.length - 1);
    }
  };

  const playNext = useCallback(() => {
    if (playlist.length === 0) return;
    const nextIndex = (currentIndex + 1) % playlist.length;
    playSong(playlist[nextIndex], nextIndex);
  }, [currentIndex, playlist]);

  const playPrevious = () => {
    if (playlist.length === 0) return;
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playSong(playlist[prevIndex], prevIndex);
  };

  const setVolume = (newVolume: number) => {
    setVolumeState(Math.min(Math.max(newVolume, 0), 1));
    if (newVolume > 0) {
        if(isReady && hasInteracted){
             setIsMuted(false);
        }
    }
  };

  const toggleMute = () => {
    if (!isReady) return;
    
    if(!hasInteracted){
        activateSound();
        return;
    }

    setIsMuted(prev => !prev);
  };

  const seek = (newProgress: number) => {
     if (playerRef.current && isReady) {
        playerRef.current.seekTo(newProgress, 'fraction');
        setProgress(newProgress);
     }
  };

  const _playerOnReady = () => {
    setIsReady(true);
  };
  
  const _playerOnProgress = (data: OnProgressProps) => {
    // Only update progress if we are in a playing state
    if (isPlaying) {
      setProgress(data.played);
    }
  };

  const _playerOnDuration = (newDuration: number) => {
    setDuration(newDuration);
  };
  
  const _playerOnPlay = () => {
    // This is the signal that the player is truly playing. Sync our state.
    if (!isPlaying) {
        setIsPlaying(true);
    }
  };

  const _playerOnPause = () => {
    // This is the signal that the player is truly paused. Sync our state.
     if (isPlaying) {
        setIsPlaying(false);
    }
  };

  const _playerOnEnded = () => {
    playNext();
  };

  const value: PlayerContextType = {
    currentSong,
    isPlaying,
    isReady,
    hasInteracted,
    playlist,
    currentIndex,
    progress,
    duration,
    volume,
    isMuted,
    playerRef,
    playSong,
    togglePlayPause,
    addSong,
    setPlaylist,
    playNext,
    playPrevious,
    setVolume,
    toggleMute,
    activateSound,
    seek,
    _playerOnReady,
    _playerOnProgress,
    _playerOnDuration,
    _playerOnEnded,
    _playerOnPlay,
    _playerOnPause,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
