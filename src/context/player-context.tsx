'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface Song {
  id: string;
  title: string;
  url: string;
  type: 'youtube' | 'soundcloud' | 'url';
  videoId?: string;
}

type PlayerContextType = {
  playlist: Song[];
  currentSong: Song | null;
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  addSong: (url: string) => Promise<void>;
  deleteSong: (songId: string) => Promise<void>;
  playSong: (index: number) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrev: () => void;
  setYoutubePlayer: (player: any) => void;
  setSoundcloudPlayer: (player: any) => void;
};

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();

  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const youtubePlayerRef = useRef<any>(null);
  const soundcloudPlayerRef = useRef<any>(null);
  const urlPlayerRef = useRef<HTMLAudioElement>(null);


  const resetPlayer = () => {
    const youtubePlayer = youtubePlayerRef.current;
    if (youtubePlayer && typeof youtubePlayer.stopVideo === 'function') {
      youtubePlayer.stopVideo();
    }
    const soundcloudPlayer = soundcloudPlayerRef.current;
    if (soundcloudPlayer && typeof soundcloudPlayer.pause === 'function') {
      try {
        soundcloudPlayer.pause();
      } catch (e) {
        // Widget already destroyed, do nothing.
      }
    }
    if (urlPlayerRef.current) {
      urlPlayerRef.current.pause();
      urlPlayerRef.current.src = '';
    }
  };
  
  useEffect(() => {
    if (playlist.length === 0) {
      setCurrentIndex(-1);
      setIsPlaying(false);
      resetPlayer();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist]);

  const extractYouTubeID = (url: string): string | null => {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const getSongDetails = async (url: string): Promise<Omit<Song, 'id'>> => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = extractYouTubeID(url);
      if (!videoId) throw new Error("Geçersiz YouTube linki.");
      const canonicalYouTubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const oembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(canonicalYouTubeUrl)}`;
      
      try {
        const response = await fetch(oembedUrl);
        if (!response.ok) throw new Error('YouTube metadata alınamadı');
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        return {
          title: data.title || `YouTube: ${videoId}`,
          url: canonicalYouTubeUrl,
          type: 'youtube',
          videoId: videoId
        };
      } catch (e) {
         return {
            title: `YouTube: ${videoId}`,
            url: canonicalYouTubeUrl,
            type: 'youtube',
            videoId: videoId
        };
      }

    } else if (url.includes('soundcloud.com')) {
      const urlParts = url.split('?');
      const cleanUrl = urlParts[0];
      const oembedUrl = `https://soundcloud.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
      
      try {
        const response = await fetch(oembedUrl);
        if (!response.ok) throw new Error("Geçersiz veya gizli SoundCloud linki.");
        const data = await response.json();
        if (!data.title) throw new Error("SoundCloud şarkı başlığı alınamadı.");
        return {
          title: data.title,
          url: cleanUrl,
          type: 'soundcloud'
        };
      } catch(e) {
         return {
            title: "SoundCloud Şarkısı",
            url: cleanUrl,
            type: 'soundcloud'
        };
      }

    } else if (url.match(/\.(mp3|wav|ogg|m4a)$/) || url.startsWith('http')) {
        const fileName = new URL(url).pathname.split('/').pop() || 'URL Şarkısı';
        return {
          title: fileName.replace(/\.[^/.]+$/, ""),
          url: url,
          type: 'url'
        };
    } else {
      throw new Error("Desteklenmeyen link türü. Lütfen YouTube, SoundCloud veya doğrudan ses linki kullanın.");
    }
  };

  const addSong = async (url: string) => {
    try {
      const songDetails = await getSongDetails(url);
      const newSong = {
        ...songDetails,
        id: new Date().toISOString(),
      };
      
      setPlaylist(prevPlaylist => {
        const updatedPlaylist = [...prevPlaylist, newSong];
        if (currentIndex === -1 && updatedPlaylist.length > 0) {
            setCurrentIndex(0);
            setIsPlaying(true);
        }
        return updatedPlaylist;
      });
      toast({ title: "Şarkı eklendi!" });

    } catch (error: any) {
      console.error("Şarkı eklenirken hata:", error);
      toast({ title: error.message || "Şarkı eklenemedi.", variant: 'destructive' });
    }
  };

  const deleteSong = async (songId: string) => {
    setPlaylist(prevPlaylist => {
        const songIndex = prevPlaylist.findIndex(s => s.id === songId);
        if (songIndex === -1) return prevPlaylist;

        const isCurrentlyPlaying = songIndex === currentIndex;
        
        const newPlaylist = prevPlaylist.filter(s => s.id !== songId);

        if (isCurrentlyPlaying) {
          resetPlayer();
          if (newPlaylist.length === 0) {
            setCurrentIndex(-1);
            setIsPlaying(false);
          } else {
            const nextIndex = (songIndex) % newPlaylist.length;
            setCurrentIndex(nextIndex);
            setIsPlaying(true);
          }
        } else if (songIndex < currentIndex) {
            setCurrentIndex(prevIndex => prevIndex - 1);
        }
        
        return newPlaylist;
    });
    toast({ title: "Şarkı silindi." });
  };
  
  const playSong = (index: number) => {
    if (index >= 0 && index < playlist.length) {
      if(currentIndex !== index) {
        resetPlayer();
      }
      setCurrentIndex(index);
      setIsPlaying(true);
    } else {
      setCurrentIndex(-1);
      setIsPlaying(false);
      resetPlayer();
    }
  };
  
  const togglePlayPause = () => {
    if (currentIndex === -1 && playlist.length > 0) {
      playSong(0);
      return;
    }
    
    if (playlist.length > 0) {
      setIsPlaying(prevIsPlaying => !prevIsPlaying);
    }
  };

  const playNext = useCallback(() => {
    if (playlist.length === 0) return;
    const nextIndex = (currentIndex + 1) % playlist.length;
    playSong(nextIndex);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, playlist.length]);

  const playPrev = () => {
    if (playlist.length === 0) return;
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playSong(prevIndex);
  };

  const setYoutubePlayer = (player: any) => {
    youtubePlayerRef.current = player;
  };
  
  const setSoundcloudPlayer = (player: any) => {
    soundcloudPlayerRef.current = player;
  }

  // YouTube Oynatıcı Kontrolü
  useEffect(() => {
    const song = playlist[currentIndex];
    const youtubePlayer = youtubePlayerRef.current;
    
    if (song?.type !== 'youtube' || !youtubePlayer || typeof youtubePlayer.playVideo !== 'function') {
      return;
    }
    
    if (isPlaying) {
      youtubePlayer.setVolume(100);
      youtubePlayer.playVideo();
    } else {
      youtubePlayer.pauseVideo();
    }
  }, [isPlaying, currentIndex, playlist]);

  // SoundCloud Oynatıcı Kontrolü
  useEffect(() => {
      const song = playlist[currentIndex];
      const soundcloudPlayer = soundcloudPlayerRef.current;

      if (song?.type !== 'soundcloud' || !soundcloudPlayer || typeof soundcloudPlayer.play !== 'function') {
          return;
      }
      
      if (isPlaying) {
          soundcloudPlayer.play();
      } else {
          soundcloudPlayer.pause();
      }
  }, [isPlaying, currentIndex, playlist]);

  // URL Oynatıcı Kontrolü
  useEffect(() => {
    const urlPlayer = urlPlayerRef.current;
    const song = playlist[currentIndex];
    
    if (!song || song.type !== 'url' || !urlPlayer) {
      return;
    }
    
    if (isPlaying) {
      urlPlayer.play().catch(e => console.error("Ses çalma başarısız:", e));
    } else {
      urlPlayer.pause();
    }
  }, [isPlaying, currentIndex, playlist, urlPlayerRef]);


  const currentSong = currentIndex > -1 ? playlist[currentIndex] : null;

  const value: PlayerContextType = {
    playlist,
    currentSong,
    currentIndex,
    isPlaying,
    isLoading,
    addSong,
    deleteSong,
    playSong,
    togglePlayPause,
    playNext,
    playPrev,
    setYoutubePlayer,
    setSoundcloudPlayer,
  };

  return (
    <PlayerContext.Provider value={value}>
        {/* URL Oynatıcısı için her zaman render olan gizli bir audio elementi */}
        <audio ref={urlPlayerRef} style={{ display: 'none' }} />
        {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = (): PlayerContextType => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer bir PlayerProvider içinde kullanılmalıdır');
  }
  return context;
};
