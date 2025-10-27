'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import type { Song } from '@/lib/data';
import { songs as allSongs } from '@/lib/data';

type Playlist = {
  name: string;
  songs: Song[];
};

type PlayerContextType = {
  songs: Song[];
  currentPlaylist: Song[];
  currentSong: Song | null;
  currentSongIndex: number;
  isPlaying: boolean;
  playlists: Playlist[];
  playSong: (song: Song, playlist?: Song[]) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrev: () => void;
  createPlaylist: (name: string, songs?: Song[]) => boolean;
  addSongToPlaylist: (playlistName: string, song: Song) => void;
  addPlaylist: (playlist: Playlist) => void;
  setCurrentPlaylist: (playlistName: string) => void;
};

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const [currentPlaylist, setCurrentPlaylistState] = useState<Song[]>(allSongs);
  const [currentSongIndex, setCurrentSongIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  const currentSong = useMemo(() => {
    return currentSongIndex >= 0 && currentSongIndex < currentPlaylist.length
      ? currentPlaylist[currentSongIndex]
      : null;
  }, [currentSongIndex, currentPlaylist]);

  const playSong = (song: Song, playlist: Song[] = currentPlaylist) => {
    const songIndex = playlist.findIndex(s => s.id === song.id);
    if (songIndex !== -1) {
      setCurrentPlaylistState(playlist);
      setCurrentSongIndex(songIndex);
      setIsPlaying(true);
    } else {
        // If song is not in the current playlist, play it as a single-song playlist
        setCurrentPlaylistState([song]);
        setCurrentSongIndex(0);
        setIsPlaying(true);
    }
  };

  const togglePlayPause = () => {
    if (currentSong) {
      setIsPlaying(prev => !prev);
    }
  };

  const playNext = () => {
    if (currentPlaylist.length > 0) {
      const nextIndex = (currentSongIndex + 1) % currentPlaylist.length;
      setCurrentSongIndex(nextIndex);
      setIsPlaying(true);
    }
  };

  const playPrev = () => {
    if (currentPlaylist.length > 0) {
      const prevIndex = (currentSongIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
      setCurrentSongIndex(prevIndex);
      setIsPlaying(true);
    }
  };

  const createPlaylist = (name: string, songs: Song[] = []) => {
    if (playlists.some(p => p.name === name)) {
      return false;
    }
    setPlaylists(prev => [...prev, { name, songs }]);
    return true;
  };

  const addSongToPlaylist = (playlistName: string, song: Song) => {
    setPlaylists(prev =>
      prev.map(p =>
        p.name === playlistName ? { ...p, songs: [...p.songs, song] } : p
      )
    );
  };
  
  const addPlaylist = (playlist: Playlist) => {
    if (playlists.some(p => p.name === playlist.name)) {
        // To avoid duplicates, maybe append a number
        const newName = `${playlist.name} (${playlists.filter(p => p.name.startsWith(playlist.name)).length + 1})`;
        setPlaylists(prev => [...prev, {...playlist, name: newName}]);
        return;
    }
    setPlaylists(prev => [...prev, playlist]);
  }

  const setCurrentPlaylist = (playlistName: string) => {
    if (playlistName === 'Library') {
        setCurrentPlaylistState(allSongs);
        return;
    }
    const playlist = playlists.find(p => p.name === playlistName);
    if (playlist) {
      setCurrentPlaylistState(playlist.songs);
    }
  };

  const value: PlayerContextType = {
    songs: allSongs,
    currentPlaylist,
    currentSong,
    currentSongIndex,
    isPlaying,
    playlists,
    playSong,
    togglePlayPause,
    playNext,
    playPrev,
    createPlaylist,
    addSongToPlaylist,
    addPlaylist,
    setCurrentPlaylist,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};

export const usePlayer = (): PlayerContextType => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
