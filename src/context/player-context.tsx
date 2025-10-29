'use client';

import React, { createContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import ReactPlayer from 'react-player';
import type { OnProgressProps } from 'react-player/base';
import type { Song } from '@/lib/types';
import { serverTimestamp } from 'firebase/firestore';

// --- TYPE DEFINITIONS ---

interface PlayerContextType {
  // State
  currentSong: Song | null;
  isPlaying: boolean;
  isReady: boolean;
  hasInteracted: boolean;
  playlist: Song[];
  currentIndex: number;
  progress: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  
  // Player Ref
  playerRef: React.RefObject<ReactPlayer> | null;

  // Actions
  playSong: (song: Song, index: number) => void;
  togglePlayPause: () => void;
  addSong: (song: Song) => void;
  setPlaylist: (playlist: Song[]) => void;
  playNext: () => void;
  playPrevious: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  activateSound: () => void;
  seek: (progress: number) => void;

  // Internal Callbacks (for the <Player /> component)
  _playerOnReady: () => void;
  _playerOnProgress: (data: OnProgressProps) => void;
  _playerOnDuration: (duration: number) => void;
  _playerOnEnded: () => void;
  _playerOnPlay: () => void;
  _playerOnPause: () => void;
}

// --- CONTEXT CREATION ---

export const PlayerContext = createContext<PlayerContextType | null>(null);


// --- PROVIDER COMPONENT ---

interface PlayerProviderProps {
  children: ReactNode;
}

export const PlayerProvider: React.FC<PlayerProviderProps> = ({ children }) => {
  // --- STATE MANAGEMENT ---
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);
  const [playlist, setPlaylistState] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [isMuted, setIsMuted] = useState(true); // Start muted as per browser policy

  const playerRef = useRef<ReactPlayer>(null);
  
  // --- CORE ACTIONS ---

  const setPlaylist = (newPlaylist: Song[]) => {
    setPlaylistState(newPlaylist);
    // If no song is playing and there are songs in the new playlist, play the first one.
    if (!currentSong && newPlaylist.length > 0) {
      playSong(newPlaylist[0], 0);
    }
  };

  const playSong = (song: Song, index: number) => {
    // This is the only place we should set the current song
    setCurrentSong(song);
    setCurrentIndex(index);
    setProgress(0);
    setDuration(0);
    setIsPlaying(true); // We intend to play
    setIsReady(false); // New song, so player is not ready yet
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

  /**
   * This is the key function to get audio permission from the browser.
   * It should be called on the first user click (e.g., on an overlay).
   */
  const activateSound = useCallback(() => {
    if (playerRef.current && !hasInteracted) {
      console.log("PlayerContext: User interaction detected, activating sound.");
      setHasInteracted(true);
      setIsMuted(false);
      
      // "Crush the penalty": If the browser paused playback upon unmuting, force it to play.
      const internalPlayer = playerRef.current.getInternalPlayer();
      if (internalPlayer && typeof internalPlayer.playVideo === 'function') {
        internalPlayer.playVideo();
      }
    }
  }, [hasInteracted, playerRef]);

  /**
   * The main play/pause toggle function for UI controls.
   * It smartly handles the initial sound activation.
   */
  const togglePlayPause = () => {
    if (!playerRef.current || !isReady) return;
    
    // If this is the first interaction, prioritize activating sound.
    if (!hasInteracted) {
      activateSound();
      return;
    }

    // After the first interaction, just toggle play/pause.
    // The actual state change will be confirmed by _playerOnPlay/_playerOnPause callbacks.
    if (isPlaying) {
      playerRef.current.getInternalPlayer()?.pauseVideo();
    } else {
      playerRef.current.getInternalPlayer()?.playVideo();
    }
  };

  const setVolume = (newVolume: number) => {
    setVolumeState(Math.min(Math.max(newVolume, 0), 1));
    // If user increases volume, assume they want sound.
    if (newVolume > 0 && hasInteracted) {
         setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!isReady) return;
    // If first interaction, activate sound instead of just toggling mute.
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
  
  // --- INTERNAL PLAYER CALLBACKS ---

  const _playerOnReady = () => {
    console.log("PlayerContext: Player is ready.");
    setIsReady(true);
  };

  const _playerOnProgress = (data: OnProgressProps) => {
    // Only update progress if the player is actually playing to avoid jumps.
    if (isPlaying) {
      setProgress(data.played);
    }
  };

  const _playerOnDuration = (newDuration: number) => setDuration(newDuration);
  
  const _playerOnEnded = () => {
    console.log("PlayerContext: Song ended, playing next.");
    playNext();
  };

  // These are crucial for syncing the UI with the player's actual state.
  const _playerOnPlay = () => {
    if (!isPlaying) {
      console.log("PlayerContext: Received onPlay signal, setting isPlaying to true.");
      setIsPlaying(true); 
    }
  };
  const _playerOnPause = () => {
    if (isPlaying) {
      console.log("PlayerContext: Received onPause signal, setting isPlaying to false.");
      setIsPlaying(false);
    }
  };

  // --- MOCK PLAYLIST ON LOAD ---
  useEffect(() => {
    const mockSong: Song = {
        id: "sBzrzS1Ag_g",
        videoId: "sBzrzS1Ag_g",
        title: "Tame Impala - The Less I Know The Better",
        url: "https://www.youtube.com/watch?v=sBzrzS1Ag_g",
        type: 'youtube',
        timestamp: serverTimestamp(),
        artwork: 'https://i.ytimg.com/vi/sBzrzS1Ag_g/sddefault.jpg',
    };
    setPlaylist([mockSong]);
  }, []);

  // --- CONTEXT VALUE ---

  const value: PlayerContextType = {
    currentSong, isPlaying, isReady, hasInteracted, playlist, currentIndex, progress, duration, volume, isMuted, playerRef,
    playSong, togglePlayPause, addSong, setPlaylist, playNext, playPrevious, setVolume, toggleMute, activateSound, seek,
    _playerOnReady, _playerOnProgress, _playerOnDuration, _playerOnEnded, _playerOnPlay, _playerOnPause,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};
