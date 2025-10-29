'use client';

import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

// 1. Şarkı nesnesinin nasıl görüneceğini tanımlayalım
export interface Song { 
  id: string;
  videoId?: string;
  title: string;
  url: string;
  type: 'youtube' | 'soundcloud' | 'url';
  timestamp?: any;
}

interface PlayerControls {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  unmute: () => void;
}

// 2. Context'in içinde hangi bilgilerin olacağını tanımlayalım
interface PlayerContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  playlist: Song[]; 
  currentIndex: number;
  isPlayerOpen: boolean;
  progress: number;
  duration: number;
  
  playSong: (song: Song, index: number) => void;
  togglePlayPause: () => void;
  addSong: (song: Song) => void; 
  setPlaylist: (playlist: Song[]) => void;
  setIsPlayerOpen: (isOpen: boolean) => void;
  seekTo: (time: number) => void;
  playNext: () => void;
  playPrev: () => void;

  _playerSetIsPlaying: (playing: boolean) => void;
  _playerSetProgress: (progress: number) => void;
  _playerSetDuration: (duration: number) => void;
  _playerOnEnd: () => void;
  _playerRegisterControls: (controls: PlayerControls) => void;
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
  const playerControlsRef = React.useRef<PlayerControls | null>(null);


  // === MANTIK FONKSİYONLARI ===

  const playSong = useCallback((song: Song, index: number) => {
    setCurrentSong(song);
    setCurrentIndex(index);
    setIsPlaying(true); // Oynatıcıya "oynat" komutu vermeyecek, sadece UI durumu
    setIsMutedByAutoplay(true); // Oynatıcı sessiz başlayacak, ilk tıklamada ses açılacak
    setProgress(0);
    setDuration(0);
  }, []);

  const playNext = useCallback(() => {
    if (playlist.length === 0) return;
    const nextIndex = (currentIndex + 1) % playlist.length;
    playSong(playlist[nextIndex], nextIndex);
  }, [currentIndex, playlist, playSong]);

  const playPrev = useCallback(() => {
    if (playlist.length === 0) return;
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playSong(playlist[prevIndex], prevIndex);
  }, [currentIndex, playlist, playSong]);


   const togglePlayPause = () => {
    if (!currentSong || !playerControlsRef.current) return;
    
    // Eğer tarayıcı engeli nedeniyle sessizdeyse, ilk tıklamada sesi aç
    if (isMutedByAutoplay) {
      playerControlsRef.current.unmute();
      setIsMutedByAutoplay(false);
    }
    
    // Gerçek oynatıcıya komut gönder
    if (isPlaying) {
      playerControlsRef.current.pause();
    } else {
      playerControlsRef.current.play();
    }
    // NOT: isPlaying state'i buradan DEĞİŞTİRİLMİYOR.
    // Oynatıcıdan gelen raporla (onStateChange -> _playerSetIsPlaying) değişecek.
  };

  const addSong = (song: Song) => {
    const newPlaylist = [...playlist, song];
    setPlaylist(newPlaylist);
    playSong(song, newPlaylist.length - 1);
  };
  
  const seekTo = (time: number) => {
    if (playerControlsRef.current) {
        setProgress(time);
        playerControlsRef.current.seek(time);
    }
  }

  // Oynatıcıdan gelen raporları işleyen fonksiyonlar
  const _playerSetIsPlaying = (playing: boolean) => setIsPlaying(playing);
  const _playerSetProgress = (p: number) => setProgress(p);
  const _playerSetDuration = (d: number) => setDuration(d);
  const _playerOnEnd = () => playNext();
  const _playerRegisterControls = (controls: PlayerControls) => {
    playerControlsRef.current = controls;
  }

  const value = {
    currentSong,
    isPlaying,
    playlist, 
    currentIndex,
    isPlayerOpen,
    progress,
    duration,
    playSong,
    togglePlayPause,
    addSong, 
    setPlaylist,
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
