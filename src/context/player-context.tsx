'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { collection, serverTimestamp, deleteDoc, doc, query, orderBy, addDoc, getDocs, where, limit, writeBatch } from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import initialCatalog from '@/app/lib/catalog.json';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

export interface Song {
  id: string; // Bu ID artık /songs koleksiyonundaki merkezi ID olacak
  title: string;
  url: string;
  type: 'youtube' | 'soundcloud' | 'url';
  videoId?: string;
  userId?: string; // Bu, şarkıyı ilk ekleyen kişi olabilir, ama anahtar değil
  timestamp?: any;
}

export type SongDetails = {
  url: string;
  title: string;
  videoId?: string;
  type: 'youtube' | 'soundcloud' | 'url';
};

type PlayerContextType = {
  playlist: Song[];
  currentSong: Song | null;
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  addSong: (songDetails: SongDetails, userId: string) => Promise<Song | null>;
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

  const userPlaylistQuery = useMemoFirebase(() => {
    if (user && firestore) {
      return query(collection(firestore, 'users', user.uid, 'playlist'), orderBy('timestamp', 'asc'));
    }
    return null;
  }, [user, firestore]);

  const { data: userPlaylist, isLoading: isPlaylistLoading } = useCollection<Song>(userPlaylistQuery);
  
  useEffect(() => {
    const isActuallyLoading = isPlaylistLoading || isUserLoading;
    setIsLoading(isActuallyLoading);
    if (isActuallyLoading) return;
  
    if (userPlaylist) {
      const currentSongId = playlist[currentIndex]?.id;
      setPlaylist(userPlaylist);
  
      if (userPlaylist.length === 0) {
        setCurrentIndex(-1);
        setIsPlaying(false);
      } else {
        const newIndex = userPlaylist.findIndex(s => s.id === currentSongId);
        if (newIndex !== -1) {
          setCurrentIndex(newIndex);
        } else if (currentIndex >= userPlaylist.length) {
          setCurrentIndex(0);
        } else if (currentIndex === -1 && userPlaylist.length > 0) {
          setCurrentIndex(0);
        }
      }
    } else if (!user) {
      setPlaylist([]);
      setCurrentIndex(-1);
      setIsPlaying(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPlaylist, isPlaylistLoading, isUserLoading, user]);


  const extractYouTubeID = (url: string): string | null => {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  useEffect(() => {
    if (firestore && user && !isPlaylistLoading && !dataLoadedRef.current && userPlaylist?.length === 0) {
      dataLoadedRef.current = true; // Sadece bir kez çalışmasını sağla
      const addInitialSongs = async () => {
        const songsToAdd = initialCatalog.songs;
        for (const song of songsToAdd) {
            const videoId = extractYouTubeID(song.url);
            if (videoId) {
                const songData: SongDetails = {
                    url: song.url,
                    title: song.title,
                    videoId,
                    type: 'youtube'
                };
                // addSong fonksiyonunu kullanarak hem globale hem kullanıcının listesine ekle
                await addSong(songData, user.uid);
            }
        }
        toast({ title: "Hoş geldin! Başlangıç için birkaç şarkı ekledik."});
      };
      addInitialSongs();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, user, isPlaylistLoading, userPlaylist]);


  const addSong = async (songDetails: SongDetails, userId: string): Promise<Song | null> => {
    if (!firestore || !user) {
      toast({ title: 'Şarkı eklemek için giriş yapmalısınız.', variant: 'destructive' });
      return null;
    }

    const songsCollectionRef = collection(firestore, 'songs');
    const userPlaylistRef = collection(firestore, 'users', user.uid, 'playlist');

    try {
        // 1. Şarkının globalde var olup olmadığını kontrol et (videoId veya url ile)
        const queryIdentifier = songDetails.videoId || songDetails.url;
        const q = query(songsCollectionRef, where(songDetails.videoId ? "videoId" : "url", "==", queryIdentifier), limit(1));
        const querySnapshot = await getDocs(q);

        let songId: string;
        let finalSongData: Song;

        if (querySnapshot.empty) {
            // 2a. Şarkı globalde yoksa, oluştur
            const newSongDocRef = doc(songsCollectionRef);
            songId = newSongDocRef.id;
            finalSongData = {
                id: songId,
                ...songDetails,
                userId: userId, // ilk ekleyen
                timestamp: serverTimestamp(),
            };
            await addDoc(songsCollectionRef, finalSongData);

        } else {
            // 2b. Şarkı globalde varsa, ID'sini ve verisini al
            const existingDoc = querySnapshot.docs[0];
            songId = existingDoc.id;
            finalSongData = { id: songId, ...existingDoc.data() } as Song;
        }

        // 3. Şarkıyı kullanıcının çalma listesine (playlist) ekle (eğer zaten yoksa)
        const userSongDocRef = doc(userPlaylistRef, songId);
        // Kullanıcının listesine de tüm şarkı bilgisini ekliyoruz ki UI hızlıca güncellensin.
        // Bu, sohbet için kullanılacak 'id'nin merkezi ID olmasını sağlar.
        const userSongData = {
            ...finalSongData, // merkezi şarkının tüm bilgileri
            id: songId,       // merkezi şarkının ID'si
            timestamp: serverTimestamp(), // kullanıcının kendi listesine ekleme zamanı
        };
        
        await addDoc(collection(firestore, 'users', user.uid, 'playlist'), userSongData);

        return finalSongData;
    } catch (error) {
        console.error("addSong hatası:", error);
        toast({ title: "Şarkı eklenirken bir hata oluştu.", variant: 'destructive' });
        return null;
    }
  };


  const deleteSong = async (songId: string) => {
    if (!firestore || !user) return;
    
    // NOT: Bu artık şarkıyı sadece kullanıcının çalma listesinden siler.
    // Global /songs koleksiyonundan silmez.
    const songDocRef = doc(firestore, 'users', user.uid, 'playlist', songId);
    
    deleteDoc(songDocRef)
      .then(() => {
        toast({ title: "Şarkı listenizden silindi." });
      })
      .catch(serverError => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: songDocRef.path,
            operation: 'delete',
        }));
      });
  };

  const playSong = useCallback((index: number) => {
    if (index >= 0 && index < playlist.length) {
      setCurrentIndex(index);
      setIsPlaying(true);
    } else {
      setCurrentIndex(-1);
      setIsPlaying(false);
    }
  }, [playlist.length]);

  const togglePlayPause = () => {
    if (currentIndex === -1 && playlist.length > 0) {
      playSong(0);
    } else if (playlist.length > 0) {
      setIsPlaying(prev => !prev);
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
  
  useEffect(() => {
    const song = playlist[currentIndex];
    const youtubePlayer = youtubePlayerRef.current;
    const soundcloudPlayer = soundcloudPlayerRef.current;
    const urlPlayer = urlPlayerRef.current;
  
    // Herhangi bir oynatıcıyı kontrol etmeden önce varlıklarından emin ol
    const safelyPauseYoutube = () => {
      if (youtubePlayer && typeof youtubePlayer.pauseVideo === 'function') {
        youtubePlayer.pauseVideo();
      }
    };
  
    const safelyPauseSoundcloud = () => {
      if (soundcloudPlayer && typeof soundcloudPlayer.pause === 'function') {
        soundcloudPlayer.pause();
      }
    };
  
    const safelyPauseUrl = () => {
      if (urlPlayer && !urlPlayer.paused) {
        urlPlayer.pause();
      }
    };
  
    if (!isPlaying) {
      safelyPauseYoutube();
      safelyPauseSoundcloud();
      safelyPauseUrl();
      return;
    }
  
    if (!song) {
      // Çalacak şarkı yoksa tüm oynatıcıları durdur
      safelyPauseYoutube();
      safelyPauseSoundcloud();
      safelyPauseUrl();
      return;
    }
  
    // Şarkı türüne göre doğru oynatıcıyı çalıştır ve diğerlerini durdur
    switch (song.type) {
      case 'youtube':
        safelyPauseSoundcloud();
        safelyPauseUrl();
        if (youtubePlayer && typeof youtubePlayer.playVideo === 'function') {
          youtubePlayer.playVideo();
        }
        break;
      case 'soundcloud':
        safelyPauseYoutube();
        safelyPauseUrl();
        if (soundcloudPlayer && typeof soundcloudPlayer.play === 'function') {
          soundcloudPlayer.play();
        }
        break;
      case 'url':
        safelyPauseYoutube();
        safelyPauseSoundcloud();
        if (urlPlayer) {
          if (urlPlayer.src !== song.url) {
            urlPlayer.src = song.url;
          }
          urlPlayer.play().catch(e => console.error("URL ses oynatma hatası:", e));
        }
        break;
      default:
        // Bilinmeyen tür, hepsini durdur
        safelyPauseYoutube();
        safelyPauseSoundcloud();
        safelyPauseUrl();
    }
  }, [isPlaying, currentIndex, playlist]);


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
    setYoutubePlayer: (player: any) => { youtubePlayerRef.current = player; },
    setSoundcloudPlayer: (player: any) => { soundcloudPlayerRef.current = player; },
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
