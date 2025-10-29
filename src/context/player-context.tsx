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

  // Ses - Tarayıcı autoplay politikası için başlangıçta sessiz
  const [volume, setVolumeState] = useState(0.8);
  const [isMuted, setIsMuted] = useState(true); // Başlangıçta sessiz
  
  // Player Referansı
  const playerRef = useRef<ReactPlayer>(null);

  // === KONTROL FONKSİYONLARI ===

  const playSong = (song: Song, index: number) => {
    setCurrentSong(song);
    setCurrentIndex(index);
    setIsPlaying(true);
    setProgress(0);
    setDuration(0);
    setIsMuted(true); // Her yeni şarkıda autoplay için sessiz başlat
  };

  const togglePlayPause = () => {
    if (!currentSong || !isReady) return;
    
    // Kullanıcının ilk etkileşimi buysa sesi aç
    if (isMuted) {
      setIsMuted(false);
    }
    
    setIsPlaying(prev => !prev);
  };

  const addSong = (song: Song) => {
    const newPlaylist = [...playlist, song];
    setPlaylist(newPlaylist);
    // Eğer çalma listesi boşsa ve ilk şarkı ekleniyorsa oynat
    if (!currentSong) {
      playSong(song, newPlaylist.length - 1);
    }
  };

  const playNext = useCallback(() => {
    if (playlist.length === 0) return;
    const nextIndex = (currentIndex + 1) % playlist.length;
    playSong(playlist[nextIndex], nextIndex);
  }, [currentIndex, playlist]); // playSong'u bağımlılıktan kaldırdık

  const playPrevious = () => {
    if (playlist.length === 0) return;
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playSong(playlist[prevIndex], prevIndex);
  };

  const setVolume = (newVolume: number) => {
    setVolumeState(Math.min(Math.max(newVolume, 0), 1));
    if (newVolume > 0) {
      setIsMuted(false); // Ses ayarı yapılırsa sessizden çık
    }
  };

  const toggleMute = () => {
    setIsMuted(prev => !prev);
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
  };

  const _playerSetIsPlaying = (playing: boolean) => {
    // Bu fonksiyon doğrudan `isPlaying` durumunu set etmemeli,
    // sadece player'ın kendi iç durumunu yansıtabilir veya
    // togglePlayPause tarafından yönetilen state'i doğrular.
    // Şimdilik doğrudan set etme mantığını koruyoruz ama daha karmaşık senaryolarda bu değişebilir.
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

  // playNext'i useCallback ile sarmaladığımız için, playSong'u bağımlılık dizisinden çıkarabiliriz.
  // Bu, gereksiz yeniden render'ları önler.
  useEffect(() => {
      // Bu, playSong'un her render'da değişmemesi için bir güvencedir, ancak
      // temel fonksiyonlar state'e bağlı olduğu için, playNext gibi fonksiyonları useCallback ile sarmalamak daha etkilidir.
  }, [playNext]);


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
