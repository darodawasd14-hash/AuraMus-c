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
  artwork?: string;
}

interface PlayerContextType {
  // Player State
  currentSong: Song | null;
  isPlaying: boolean;
  isReady: boolean;
  hasInteracted: boolean; // For browser permission
  
  // Playlist State
  playlist: Song[];
  currentIndex: number;
  
  // Time State
  progress: number; // 0-1
  duration: number; // seconds

  // Volume State
  volume: number; // 0-1
  isMuted: boolean;

  // Control Reference
  playerRef: React.RefObject<ReactPlayer> | null;

  // Core Controls
  playSong: (song: Song, index: number) => void;
  togglePlayPause: () => void;
  addSong: (song: Song) => void;
  setPlaylist: (playlist: Song[]) => void;
  playNext: () => void;
  playPrevious: () => void;
  
  // Volume Controls
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  activateSound: () => void;

  // Seek Control
  seek: (progress: number) => void;

  // Internal Player Reporting Functions (not for external use)
  _playerOnReady: () => void;
  _playerOnProgress: (data: OnProgressProps) => void;
  _playerOnDuration: (duration: number) => void;
  _playerOnEnded: () => void;
  _playerOnPlay: () => void;
  _playerOnPause: () => void;
}

export const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  // Player State
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false); // This is the master "permission" switch

  // Playlist
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  // Time
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Volume
  const [volume, setVolumeState] = useState(0.8);
  // Start muted until user interacts. This is key for autoplay policies.
  const [isMuted, setIsMuted] = useState(true);
  
  const playerRef = useRef<ReactPlayer>(null);

  const activateSound = useCallback(() => {
    if (!hasInteracted) {
      setHasInteracted(true);
      // This is the first user interaction. Unmute audio for all subsequent plays.
      setIsMuted(false);
      // If a song is loaded and ready, ensure it plays.
      if (playerRef.current && currentSong) {
          playerRef.current.getInternalPlayer()?.unMute();
          if(!isPlaying){
            playerRef.current.getInternalPlayer()?.playVideo();
          }
      }
    }
  }, [hasInteracted, isPlaying, currentSong]);

  const playSong = (song: Song, index: number) => {
    setCurrentSong(song);
    setCurrentIndex(index);
    setProgress(0);
    setDuration(0);
    setIsPlaying(false); // Will be set to true by onPlay event from player
    setIsReady(false); // Player is not ready until the new song loads
  };
  
  const togglePlayPause = () => {
    if (!isReady || !currentSong) return;

    // If this is the first interaction, activate sound and let it handle playback.
    if (!hasInteracted) {
        activateSound();
        return;
    }
    
    // If already interacted, just toggle play/pause state.
    if (isPlaying) {
      playerRef.current?.getInternalPlayer()?.pauseVideo();
    } else {
      playerRef.current?.getInternalPlayer()?.playVideo();
    }
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
    if (newVolume > 0 && hasInteracted) {
         setIsMuted(false);
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

  // --- Internal Callbacks from ReactPlayer ---
  const _playerOnReady = () => {
    setIsReady(true);
  };
  
  const _playerOnProgress = (data: OnProgressProps) => {
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
