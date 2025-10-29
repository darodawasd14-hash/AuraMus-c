'use client';

import React, { createContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import ReactPlayer from 'react-player';
import type { OnProgressProps } from 'react-player/base';
import type { Song } from '@/lib/types';
import catalog from '@/app/lib/catalog.json'; // Import the catalog

// --- TYPE DEFINITIONS ---

interface PlayerContextType {
  // State
  currentSong: Song | null;
  isPlaying: boolean;
  isReady: boolean;
  hasInteracted: boolean;
  playlist: Song[];
  currentIndex: number;
  
  // Player Ref
  playerRef: React.RefObject<ReactPlayer> | null;

  // Actions
  playSong: (song: Song, index: number) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  activateSound: () => void;

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
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [volume, setVolume] = useState(0.8); // Default volume

  const playerRef = useRef<ReactPlayer>(null);
  
  // --- CORE ACTIONS ---

  const playSong = (song: Song, index: number) => {
    setCurrentSong(song);
    setCurrentIndex(index);
    // Automatically start playing, but it will be muted until interaction
    setIsPlaying(true); 
    // Player is not ready for the new song yet
    setIsReady(false); 
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

  const activateSound = useCallback(() => {
    if (playerRef.current && !hasInteracted) {
      const internalPlayer = playerRef.current.getInternalPlayer();
      if (internalPlayer) {
          // These calls are crucial to get audio playing
          // after the first user interaction.
          internalPlayer.unMute();
          internalPlayer.playVideo(); // Also ensure it plays to "crush the penalty"
      }
      setHasInteracted(true);
    }
  }, [hasInteracted]);

  const togglePlayPause = () => {
    if (!playerRef.current || !isReady) return;

    // If this is the first interaction, activate sound and play
    if (!hasInteracted) {
        activateSound();
        return;
    }
    
    // If sound is already active, just toggle play/pause
    const internalPlayer = playerRef.current.getInternalPlayer();
    if (isPlaying) {
        internalPlayer?.pauseVideo();
    } else {
        internalPlayer?.playVideo();
    }
  };
  
  // --- INTERNAL PLAYER CALLBACKS ---

  const _playerOnReady = () => setIsReady(true);
  const _playerOnProgress = (data: OnProgressProps) => { /* Will be used for progress bar */ };
  const _playerOnDuration = (duration: number) => { /* Will be used for progress bar */ };
  const _playerOnEnded = () => playNext();
  const _playerOnPlay = () => setIsPlaying(true);
  const _playerOnPause = () => setIsPlaying(false);


  // Load initial playlist from catalog
  useEffect(() => {
      const songsWithArt = catalog.songs.map(song => ({
        ...song,
        artwork: `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`
      }));
      setPlaylist(songsWithArt);
      // Set the first song but don't play it until the component is ready
      if (songsWithArt.length > 0) {
        playSong(songsWithArt[0], 0);
      }
  }, []);

  // --- CONTEXT VALUE ---

  const value: PlayerContextType = {
    currentSong, isPlaying, isReady, hasInteracted, playlist, currentIndex, playerRef,
    playSong, togglePlayPause, playNext, playPrevious, activateSound,
    _playerOnReady, _playerOnProgress, _playerOnDuration, _playerOnEnded, _playerOnPlay, _playerOnPause,
  };

  return (
    <PlayerContext.Provider value={value}>
      {/* The invisible player motor is always present */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9900px' }}>
          <ReactPlayer
            ref={playerRef}
            url={currentSong?.url}
            playing={isPlaying}
            volume={volume}
            muted={!hasInteracted} // Control mute based on interaction
            onReady={_playerOnReady}
            onPlay={_playerOnPlay}
            onPause={_playerOnPause}
            onEnded={_playerOnEnded}
            onProgress={_playerOnProgress}
            onDuration={_playerOnDuration}
            config={{
              youtube: {
                playerVars: { 
                  autoplay: 1, 
                  controls: 0,
                  disablekb: 1,
                  iv_load_policy: 3,
                  modestbranding: 1,
                  rel: 0,
                }
              },
            }}
          />
      </div>
      {children}
    </PlayerContext.Provider>
  );
};
