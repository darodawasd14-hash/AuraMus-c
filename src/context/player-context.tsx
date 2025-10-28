'use client';

import React, { createContext, useState, useContext, ReactNode } from 'react';

// 1. Şarkı nesnesinin nasıl görüneceğini tanımlayalım
export interface Song { 
  id: string;
  videoId?: string;
  title: string;
  url: string;
  type: 'youtube' | 'soundcloud' | 'url';
  timestamp?: any;
}

// 2. Context'in içinde hangi bilgilerin olacağını tanımlayalım
interface PlayerContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  playlist: Song[]; 
  playSong: (song: Song, index: number) => void;
  togglePlayPause: () => void;
  addSong: (song: Song) => void; 
  setPlaylist: (playlist: Song[]) => void;
  currentIndex: number;

  isPlayerOpen: boolean;
  progress: number;
  duration: number;
  
  setIsPlayerOpen: (isOpen: boolean) => void;
  seekTo: (time: number) => void;
  playNext: () => void;
  playPrev: () => void;

  _playerSetIsPlaying: (playing: boolean) => void;
  _playerSetProgress: (progress: number) => void;
  _playerSetDuration: (duration: number) => void;
  _playerOnEnd: () => void;
  _playerRegisterControls: (controls: any) => void;
}

// 3. Context'i oluşturalım
export const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

// 4. Provider (Sağlayıcı) Bileşeni
export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlayerOpen, setIsPlayerOpen] = useState<boolean>(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMutedByAutoplay, setIsMutedByAutoplay] = useState(false);
  const playerControlsRef = React.useRef<any>(null);


  // === MANTIK FONKSİYONLARI ===

  // Fonksiyon 1: BİR ŞARKIYI OYNAT (Listeden tıklayınca)
  const playSong = (song: Song, index: number) => {
    setCurrentSong(song);
    setCurrentIndex(index);
    setIsPlaying(true);
    setIsMutedByAutoplay(true);
    setProgress(0);
    setDuration(0);
  };

  const playNext = React.useCallback(() => {
    if (playlist.length === 0) return;
    const nextIndex = (currentIndex + 1) % playlist.length;
    playSong(playlist[nextIndex], nextIndex);
  }, [currentIndex, playlist]);

  const playPrev = () => {
    if (playlist.length === 0) return;
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playSong(playlist[prevIndex], prevIndex);
  };


  // Fonksiyon 2: ÇAL / DURDUR (Player bar'daki buton)
   const togglePlayPause = () => {
    if (!currentSong) return;
    
    if (isMutedByAutoplay) {
      playerControlsRef.current?.unmute();
      setIsMutedByAutoplay(false);
    }

    if (isPlaying) {
      playerControlsRef.current?.pause();
    } else {
      playerControlsRef.current?.play();
    }
  };

  // YENİ Fonksiyon 3: LİSTEYE YENİ ŞARKI EKLE VE ÇAL (Ekle butonu)
  const addSong = (song: Song) => {
    const newPlaylist = [...playlist, song];
    setPlaylist(newPlaylist);
    playSong(song, newPlaylist.length - 1);
  };
  
  const seekTo = (time: number) => {
    setProgress(time);
    playerControlsRef.current?.seek(time);
  }

  const _playerSetIsPlaying = (playing: boolean) => setIsPlaying(playing);
  const _playerSetProgress = (p: number) => setProgress(p);
  const _playerSetDuration = (d: number) => setDuration(d);
  const _playerOnEnd = () => playNext();
  const _playerRegisterControls = (controls: any) => {
    playerControlsRef.current = controls;
  }

  // Bu fonksiyonları ve state'leri tüm uygulamaya "dağıtıyoruz"
  const value = {
    currentSong,
    isPlaying,
    playlist, 
    playSong,
    togglePlayPause,
    addSong, 
    setPlaylist,
    currentIndex,
    isPlayerOpen,
    progress,
    duration,
    setIsPlayerOpen,
    seekTo,
    playNext,
    playPrev,
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

// 5. Kolay kullanım için 'hook'
export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
