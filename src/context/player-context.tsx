'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { addDoc, collection, serverTimestamp, deleteDoc, doc, query, orderBy, getDocs, where, limit } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import initialCatalog from '@/app/lib/catalog.json';

export interface Song {
  id: string;
  title: string;
  url: string;
  type: 'youtube' | 'soundcloud' | 'url';
  videoId?: string;
  userId?: string;
  timestamp?: any;
}

export type SongDetails = {
  url: string;
  title?: string;
  videoId?: string;
  type?: 'youtube' | 'soundcloud' | 'url';
};

type PlayerContextType = {
  playlist: Song[];
  currentSong: Song | null;
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  addSong: (songDetails: SongDetails, userId: string) => Promise<void>;
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
  const dataLoadedRef = useRef(false);

  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const youtubePlayerRef = useRef<any>(null);
  const soundcloudPlayerRef = useRef<any>(null);
  const urlPlayerRef = useRef<HTMLAudioElement | null>(null);
  
  const resetPlayer = useCallback(() => {
    const youtubePlayer = youtubePlayerRef.current;
    if (youtubePlayer && typeof youtubePlayer.stopVideo === 'function') {
      try {
        youtubePlayer.stopVideo();
      } catch (e) { /* Hata bastırma */ }
    }
    const soundcloudPlayer = soundcloudPlayerRef.current;
    if (soundcloudPlayer && typeof soundcloudPlayer.pause === 'function') {
      try {
        soundcloudPlayer.pause();
      } catch (e) { /* Widget zaten yok edilmiş olabilir. */ }
    }
    if (urlPlayerRef.current) {
      urlPlayerRef.current.pause();
      if (urlPlayerRef.current.src) {
        urlPlayerRef.current.src = '';
      }
    }
  }, []);
  
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
        const oldPlaylistLength = playlist.length;
        setPlaylist(userPlaylist);

        // Eğer çalma listesi boşaldıysa veya ilk defa yükleniyorsa durumu ayarla
        if (userPlaylist.length === 0) {
            setCurrentIndex(-1);
            setIsPlaying(false);
            resetPlayer();
        } else if (oldPlaylistLength === 0 && userPlaylist.length > 0 && currentIndex === -1) {
            // İlk şarkılar eklendiğinde ilk şarkıyı seç ama çalma
            setCurrentIndex(0);
            setIsPlaying(false);
        } else if (currentIndex >= userPlaylist.length) {
            // Çalan şarkı silindiğinde ve son şarkıysa, listenin başına dön
            setCurrentIndex(0);
            setIsPlaying(false); // Otomatik çalmayı durdur
        }
      } else if (!user) { 
        setPlaylist([]);
        setCurrentIndex(-1);
        setIsPlaying(false);
        resetPlayer();
      }
    }
  }, [userPlaylist, isPlaylistLoading, user, resetPlayer, currentIndex, playlist.length]);

  useEffect(() => {
    if (firestore && user && !isPlaylistLoading && dataLoadedRef.current === false && userPlaylist?.length === 0) {
        dataLoadedRef.current = true; // Sadece bir kere çalışsın
        const addInitialSongs = async () => {
            for (const song of initialCatalog.songs) {
                // Burada addSong içindeki mantığı tekrar uygulamak yerine doğrudan detayları iletiyoruz.
                await addSong({ 
                    url: song.url, 
                    title: song.title, 
                    videoId: extractYouTubeID(song.url) || undefined,
                    type: 'youtube'
                }, user.uid);
            }
        };

        addInitialSongs();
    }
  }, [firestore, user, isPlaylistLoading, userPlaylist]);


  useEffect(() => {
    if (!isLoading && playlist.length === 0) {
      setCurrentIndex(-1);
      setIsPlaying(false);
      resetPlayer();
    }
  }, [playlist, isLoading, resetPlayer]);

  const extractYouTubeID = (url: string): string | null => {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const getSongDetails = async (details: SongDetails, userId: string): Promise<Omit<Song, 'id'>> => {
    const { url } = details;

    if (details.title && details.type) {
      return {
        title: details.title,
        url: details.url,
        type: details.type,
        videoId: details.videoId,
        userId: userId,
        timestamp: serverTimestamp(),
      };
    }

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

  const addSong = async (songDetailsInput: SongDetails, userId: string) => {
    if (!firestore || !user) {
      toast({ title: 'Şarkı eklemek için giriş yapmalısınız.', variant: 'destructive'});
      return;
    }
  
    try {
      const fullSongDetails = await getSongDetails(songDetailsInput, userId);
  
      const songData: Omit<Song, 'id'> = {
        title: fullSongDetails.title,
        url: fullSongDetails.url,
        type: fullSongDetails.type,
        userId: fullSongDetails.userId,
        timestamp: fullSongDetails.timestamp,
        ...(fullSongDetails.videoId && { videoId: fullSongDetails.videoId }),
      };
      
      const songsColRef = collection(firestore, 'songs');
      const q = query(
        songsColRef, 
        where(songData.videoId ? 'videoId' : 'url', '==', songData.videoId || songData.url), 
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        await addDoc(songsColRef, songData);
      }
      
      const userPlaylistRef = collection(firestore, 'users', user.uid, 'playlist');
      await addDoc(userPlaylistRef, songData);
  
      if (songDetailsInput.title) {
        toast({ title: `"${songDetailsInput.title}" eklendi!`});
      } else {
        toast({ title: "Şarkı eklendi!" });
      }
  
    } catch (error: any) {
      console.error("Şarkı eklenirken hata:", error);
      toast({ title: error.message || "Şarkı eklenemedi.", variant: 'destructive' });
    }
  };

  const deleteSong = async (songId: string) => {
    if (!firestore || !user) return;

    const songIndex = playlist.findIndex(s => s.id === songId);
    if (songIndex === -1) return;

    const songDocRef = doc(firestore, 'users', user.uid, 'playlist', songId);
    await deleteDoc(songDocRef);
    
    // Firestore'dan veri silindikten sonra `useCollection` hook'u otomatik olarak
    // playlist state'ini güncelleyecektir. Bu yüzden manuel state güncellemesi (setPlaylist)
    // çoğu zaman gereksizdir ve re-render döngülerine neden olabilir.
    // useEffect [userPlaylist] bağımlılığı bu durumu yönetecek.
    
    toast({ title: "Şarkı silindi." });
  };
  
  const playSong = useCallback((index: number) => {
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
  }, [playlist, currentIndex, resetPlayer]);
  
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
  }, [currentIndex, playlist.length, playSong]);

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

  // Consolidated useEffect for player logic
  useEffect(() => {
    const song = playlist[currentIndex];
    const youtubePlayer = youtubePlayerRef.current;
    const soundcloudPlayer = soundcloudPlayerRef.current;
    const urlPlayer = urlPlayerRef.current;

    if (!song) {
      resetPlayer();
      return;
    }

    if (isPlaying) {
      // Play the correct player based on song type
      switch (song.type) {
        case 'youtube':
          if (soundcloudPlayer && typeof soundcloudPlayer.pause === 'function') soundcloudPlayer.pause();
          if (urlPlayer && !urlPlayer.paused) urlPlayer.pause();
          if (youtubePlayer && typeof youtubePlayer.playVideo === 'function') {
            youtubePlayer.playVideo();
          }
          break;
        case 'soundcloud':
          if (youtubePlayer && typeof youtubePlayer.pauseVideo === 'function') youtubePlayer.pauseVideo();
          if (urlPlayer && !urlPlayer.paused) urlPlayer.pause();
          if (soundcloudPlayer && typeof soundcloudPlayer.play === 'function') {
            soundcloudPlayer.play();
          }
          break;
        case 'url':
          if (youtubePlayer && typeof youtubePlayer.pauseVideo === 'function') youtubePlayer.pauseVideo();
          if (soundcloudPlayer && typeof soundcloudPlayer.pause === 'function') soundcloudPlayer.pause();
          if (urlPlayer) {
            if (urlPlayer.src !== song.url) {
              urlPlayer.src = song.url;
            }
            urlPlayer.play().catch(e => console.error("URL audio playback failed:", e));
          }
          break;
      }
    } else {
      // Pause all players if not playing
      if (youtubePlayer && typeof youtubePlayer.pauseVideo === 'function') {
        youtubePlayer.pauseVideo();
      }
      if (soundcloudPlayer && typeof soundcloudPlayer.pause === 'function') {
        soundcloudPlayer.pause();
      }
      if (urlPlayer && !urlPlayer.paused) {
        urlPlayer.pause();
      }
    }

  }, [isPlaying, currentIndex, playlist, resetPlayer]);

  const currentSong = currentIndex > -1 ? playlist[currentIndex] : null;

  const value: PlayerContextType = {
    playlist,
    currentSong,
    currentIndex,
    isPlaying,
    isLoading: isLoading || isUserLoading,
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
