'use client';
import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useRef } from 'react';
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

  // İlerleme Kontrolü
  seek: (progress: number) => void;

  // Dahili Oynatıcı Raporlama Fonksiyonları (Dışarıdan kullanılmamalı)
  _playerOnReady: () => void;
  _playerSetIsPlaying: (playing: boolean) => void;
  _playerOnProgress: (data: OnProgressProps) => void;
  _playerOnDuration: (duration: number) => void;
  _playerOnEnded: () => void;
}

export const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  // Oynatıcı Durumu
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);

  // Çalma Listesi
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  // Zaman
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Ses
  const [volume, setVolumeState] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isMutedByAutoplay, setIsMutedByAutoplay] = useState(true);

  // Player Referansı
  const playerRef = useRef<ReactPlayer>(null);

  // === KONTROL FONKSİYONLARI ===

  const playSong = (song: Song, index: number) => {
    setCurrentSong(song);
    setCurrentIndex(index);
    setIsPlaying(true);
    setProgress(0);
    setDuration(0);
    setIsMutedByAutoplay(true); // Yeni şarkı yüklendiğinde, autoplay için sessize al
  };

  const togglePlayPause = () => {
    if (!currentSong || !isReady) return;
    
    // Eğer tarayıcı otomatik oynatmayı engellediği için sessizdeyse,
    // ilk oynat tuşuna basıldığında sesi aç.
    if (isMutedByAutoplay) {
      setIsMuted(false);
      setIsMutedByAutoplay(false);
    }
    
    setIsPlaying(prev => !prev);
  };

  const addSong = (song: Song) => {
    const existingIndex = playlist.findIndex(s => s.id === song.id);
    if (existingIndex !== -1) {
      if(currentIndex !== existingIndex) {
        playSong(song, existingIndex);
      } else {
        // Zaten çalan şarkıysa, sadece çalmaya başla/devam et
        togglePlayPause();
      }
    } else {
      const newPlaylist = [...playlist, song];
      setPlaylist(newPlaylist);
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
      setIsMuted(false);
      setIsMutedByAutoplay(false); // Kullanıcı sesi manuel olarak açtı
    }
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (!newMutedState) {
        setIsMutedByAutoplay(false); // Kullanıcı sesi manuel olarak açtı
    }
  };

  const seek = (newProgress: number) => {
     if (playerRef.current) {
        playerRef.current.seekTo(newProgress, 'fraction');
        setProgress(newProgress); // Arayüzü anında güncelle
     }
  };

  // === OYNATICIDAN GELEN RAPORLARI İŞLEYEN FONKSİYONLAR ===

  const _playerOnReady = () => {
    setIsReady(true);
    // Yeni şarkı hazır olduğunda, autoplay için sessiz durumda başlat
    setIsMuted(true);
  };

  const _playerSetIsPlaying = (playing: boolean) => {
    setIsPlaying(playing);
  };

  const _playerOnProgress = (data: OnProgressProps) => {
    setProgress(data.played);
  };

  const _playerOnDuration = (newDuration: number) => {
    setDuration(newDuration);
  };

  const _playerOnEnded = () => {
    playNext();
  };


  const value: PlayerContextType = {
    currentSong,
    isPlaying,
    isReady,
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
    seek,
    _playerOnReady,
    _playerSetIsPlaying,
    _playerOnProgress,
    _playerOnDuration,
    _playerOnEnded,
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
