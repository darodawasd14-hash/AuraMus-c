'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { addDoc, collection, serverTimestamp, deleteDoc, doc, query, orderBy, getDocs, where, limit } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';


export interface Song {
  id: string;
  title: string;
  url: string;
  type: 'youtube' | 'soundcloud' | 'url';
  videoId?: string;
  userId?: string;
  timestamp?: any;
}

type PlayerContextType = {
  playlist: Song[];
  currentSong: Song | null;
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  addSong: (url: string, userId: string) => Promise<void>;
  addSongToUserPlaylist: (song: Omit<Song, 'id'>) => Promise<void>;
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
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start loading until initial playlist is fetched
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
  
  // Fetch user's playlist from Firestore on login
  const userPlaylistQuery = useMemoFirebase(() => {
    if (user && firestore) {
      return query(collection(firestore, 'users', user.uid, 'playlist'), orderBy('timestamp', 'asc'));
    }
    return null;
  }, [user, firestore]);

  const { data: userPlaylist, isLoading: isPlaylistLoading } = useCollection<Song>(userPlaylistQuery);
  
  useEffect(() => {
    setIsLoading(isPlaylistLoading);
    if (!isPlaylistLoading) {
      if (userPlaylist) {
        setPlaylist(userPlaylist);
        if (userPlaylist.length > 0 && currentIndex === -1) {
          setCurrentIndex(0);
          setIsPlaying(false);
        } else if (userPlaylist.length === 0) {
          setCurrentIndex(-1);
        }
      } else if (!user) { // User logged out
        setPlaylist([]);
        setCurrentIndex(-1);
        setIsPlaying(false);
        resetPlayer();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPlaylist, isPlaylistLoading, user]);


  useEffect(() => {
    if (!isLoading && playlist.length === 0) {
      setCurrentIndex(-1);
      setIsPlaying(false);
      resetPlayer();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist, isLoading]);

  const extractYouTubeID = (url: string): string | null => {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const getSongDetails = async (url: string, userId: string): Promise<Omit<Song, 'id'>> => {
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
          videoId: videoId,
          userId: userId,
          timestamp: serverTimestamp(),
        };
      } catch (e) {
         return {
            title: `YouTube: ${videoId}`,
            url: canonicalYouTubeUrl,
            type: 'youtube',
            videoId: videoId,
            userId: userId,
            timestamp: serverTimestamp(),
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
          type: 'soundcloud',
          userId: userId,
          timestamp: serverTimestamp(),
        };
      } catch(e) {
         return {
            title: "SoundCloud Şarkısı",
            url: cleanUrl,
            type: 'soundcloud',
            userId: userId,
            timestamp: serverTimestamp(),
        };
      }

    } else if (url.match(/\.(mp3|wav|ogg|m4a)$/) || url.startsWith('http')) {
        const fileName = new URL(url).pathname.split('/').pop() || 'URL Şarkısı';
        return {
          title: fileName.replace(/\.[^/.]+$/, ""),
          url: url,
          type: 'url',
          userId: userId,
          timestamp: serverTimestamp(),
        };
    } else {
      throw new Error("Desteklenmeyen link türü. Lütfen YouTube, SoundCloud veya doğrudan ses linki kullanın.");
    }
  };

  const addSongToUserPlaylist = async (song: Omit<Song, 'id'>) => {
    if (!firestore || !user) {
      toast({ title: 'Şarkı eklemek için giriş yapmalısınız.', variant: 'destructive'});
      return;
    }
    const userPlaylistRef = collection(firestore, 'users', user.uid, 'playlist');
    await addDoc(userPlaylistRef, song);
    toast({ title: `"${song.title}" listenize eklendi!` });
  }

  const addSong = async (url: string, userId: string) => {
    if (!firestore || !user) {
        toast({ title: 'Şarkı eklemek için giriş yapmalısınız.', variant: 'destructive'});
        return;
    }

    try {
      const songDetails = await getSongDetails(url, userId);
      
      // FIRST, check if song already exists in the global catalog
      const songsCol = collection(firestore, 'songs');
      let q;
      if (songDetails.videoId) {
        q = query(songsCol, where('videoId', '==', songDetails.videoId), limit(1));
      } else {
        q = query(songsCol, where('url', '==', songDetails.url), limit(1));
      }
      
      const querySnapshot = await getDocs(q);
      
      // If it doesn't exist, add it to the global catalog
      if (querySnapshot.empty) {
        await addDoc(songsCol, songDetails);
      }

      // THEN, add to user's personal playlist
      const userPlaylistRef = collection(firestore, 'users', user.uid, 'playlist');
      await addDoc(userPlaylistRef, songDetails);


      toast({ title: "Şarkı eklendi!" });

    } catch (error: any) {
      console.error("Şarkı eklenirken hata:", error);
      toast({ title: error.message || "Şarkı eklenemedi.", variant: 'destructive' });
    }
  };

  const deleteSong = async (songId: string) => {
    if (!firestore || !user) return;

    // Delete from Firestore
    const songDocRef = doc(firestore, 'users', user.uid, 'playlist', songId);
    await deleteDoc(songDocRef);

    // After deletion, the useCollection hook will update the playlist
    // We just need to handle the currently playing index
    
    const songIndex = playlist.findIndex(s => s.id === songId);
    if (songIndex === -1) return; // Should not happen

    const isCurrentlyPlaying = songIndex === currentIndex;
    const newPlaylist = playlist.filter(s => s.id !== songId);

    if (isCurrentlyPlaying) {
      resetPlayer();
      if (newPlaylist.length === 0) {
        setCurrentIndex(-1);
        setIsPlaying(false);
      } else {
        // Play the next song, wrapping around if it was the last one
        const nextIndex = songIndex % newPlaylist.length;
        setCurrentIndex(nextIndex);
        setIsPlaying(true);
      }
    } else if (songIndex < currentIndex) {
        // If a song before the current one is deleted, adjust the index
        setCurrentIndex(prevIndex => prevIndex - 1);
    }
    
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
    
    if (!song || song.type !== 'youtube' || !youtubePlayer || typeof youtubePlayer.playVideo !== 'function') {
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

      if (!song || song.type !== 'soundcloud' || !soundcloudPlayer || typeof soundcloudPlayer.play !== 'function') {
          return;
      }
      
      if (isPlaying) {
          soundcloudPlayer.play();
      } else {
         if (soundcloudPlayer && typeof soundcloudPlayer.pause === 'function') {
          soundcloudPlayer.pause();
        }
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
      if (urlPlayer.src !== song.url) {
        urlPlayer.src = song.url;
      }
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
    addSongToUserPlaylist,
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
        <audio ref={urlPlayerRef} onEnded={playNext} style={{ display: 'none' }} />
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
