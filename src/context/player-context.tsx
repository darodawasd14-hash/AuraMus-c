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
  playSong: (song: Song, index: number) => void;
  togglePlayPause: () => void;
  addSong: (song: Song) => void;
  playlist: Song[];
  setPlaylist: (playlist: Song[]) => void;
  currentIndex: number;

  // Ses ve ilerleme kontrolleri kaldırıldı.
  // Bu, temel oynatıcıya geri dönmek içindir.
}

// 3. Context'i oluşturalım
export const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

// 4. Provider (Sağlayıcı) Bileşeni
export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  // === MANTIK FONKSİYONLARI ===

  const playSong = (song: Song, index: number) => {
    setCurrentSong(song);
    setCurrentIndex(index);
    setIsPlaying(true);
  };

  const togglePlayPause = () => {
    if (!currentSong) return;
    setIsPlaying(prev => !prev);
  };
  
  const addSong = (song: Song) => {
    const existingIndex = playlist.findIndex(s => s.id === song.id);
    if (existingIndex !== -1) {
        if(currentIndex !== existingIndex) {
          playSong(song, existingIndex);
        }
    } else {
        const newPlaylist = [...playlist, song];
        setPlaylist(newPlaylist);
        playSong(song, newPlaylist.length - 1);
    }
  };


  const value: PlayerContextType = {
    currentSong,
    isPlaying,
    playlist,
    currentIndex,
    playSong,
    togglePlayPause,
    addSong,
    setPlaylist,
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
