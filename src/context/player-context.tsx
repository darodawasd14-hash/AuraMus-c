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

// Player'ın iç kontrol fonksiyonları için arayüz. Artık daha basit.
interface PlayerControls {
  // Gelecekte spesifik kontroller gerekirse buraya eklenebilir, şimdilik boş.
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
  volume: number;
  isMuted: boolean;
  
  playSong: (song: Song, index: number) => void;
  togglePlayPause: () => void;
  addSong: (song: Song) => void; 
  setPlaylist: (playlist: Song[]) => void;
  setIsPlayerOpen: (isOpen: boolean) => void;
  seekTo: (time: number) => void;
  playNext: () => void;
  playPrev: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;

  // Dahili oynatıcı raporlaması için fonksiyonlar. Bunlar arayüz tarafından çağrılmaz.
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
  const [volume, setVolumeState] = useState(0.75);
  const [isMuted, setIsMuted] = useState(false);
  const playerControlsRef = React.useRef<PlayerControls | null>(null);
  const internalPlayerRef = React.useRef<{ seekTo: (time: number) => void } | null>(null);


  // === MANTIK FONKSİYONLARI ===

  const playSong = useCallback((song: Song, index: number) => {
    setCurrentSong(song);
    setCurrentIndex(index);
    setIsPlaying(true); 
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
    if (!currentSong) return;
    // Sadece isPlaying durumunu değiştiriyoruz. 
    // ReactPlayer bu prop değişikliğine göre kendi içinde çalma/durdurma işlemini yapar.
    setIsPlaying(prev => !prev);
  };

  const addSong = (song: Song) => {
    // Şarkının listede olup olmadığını kontrol et
    const existingIndex = playlist.findIndex(s => s.id === song.id);
    if (existingIndex !== -1) {
        // Eğer şarkı zaten listede ise ve o an çalmıyorsa, onu çal
        if(currentIndex !== existingIndex) {
          playSong(song, existingIndex);
        }
    } else {
        // Eğer şarkı listede yoksa, listeye ekle ve çal
        const newPlaylist = [...playlist, song];
        setPlaylist(newPlaylist);
        playSong(song, newPlaylist.length - 1);
    }
  };
  
  const seekTo = (time: number) => {
    // ReactPlayer'ın 'seekTo' metodunu doğrudan kullanmak yerine
    // bu state değişikliği ve player'ın prop'ları üzerinden ilerlemek daha güvenli olabilir.
    // Şimdilik bu kısmı doğrudan player'a bağlamadan state'i güncelliyoruz.
    // Daha gelişmiş seek için player'dan ref almak gerekir.
    setProgress(time);
    if (internalPlayerRef.current) {
        internalPlayerRef.current.seekTo(time);
    }
  }

  const setVolume = (newVolume: number) => {
    setVolumeState(newVolume);
    if(isMuted && newVolume > 0) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(prev => !prev);
  };


  // Oynatıcıdan gelen raporları işleyen fonksiyonlar
  const _playerSetIsPlaying = (playing: boolean) => setIsPlaying(playing);
  const _playerSetProgress = (p: number) => setProgress(p);
  const _playerSetDuration = (d: number) => setDuration(d);
  const _playerOnEnd = () => playNext();
  // Bu fonksiyon artık doğrudan bir şey yapmıyor ama uyumluluk için kalabilir.
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
    volume,
    isMuted,
    playSong,
    togglePlayPause,
    addSong, 
    setPlaylist,
    setIsPlayerOpen,
    seekTo,
    playNext,
    playPrev,
    setVolume,
    toggleMute,
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
