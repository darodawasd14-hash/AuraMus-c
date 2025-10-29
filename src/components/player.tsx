'use client';
import React from 'react';
import YouTube from 'react-youtube';
import { usePlayer } from '@/context/player-context';

export const Player = () => {
  const { currentSong, isPlaying, togglePlayPause, playSong, playlist } = usePlayer();

  const handleStateChange = (event: any) => {
    // Oynatıcı durduğunda veya bittiğinde, isPlaying durumunu false yapabiliriz.
    if (event.data === YouTube.PlayerState.PAUSED || event.data === YouTube.PlayerState.ENDED) {
      if (isPlaying) {
        togglePlayPause(); // Context'teki durumu senkronize et
      }
    }
    // Oynatıcı çalmaya başladığında
    if (event.data === YouTube.PlayerState.PLAYING) {
        if (!isPlaying) {
            togglePlayPause(); // Context'teki durumu senkronize et
        }
    }
  };

  const handleEnd = () => {
      const { currentIndex } = usePlayer.getState(); // anlık durumu al
      if (currentIndex < playlist.length - 1) {
          playSong(playlist[currentIndex + 1], currentIndex + 1);
      }
  }

  if (!currentSong || currentSong.type !== 'youtube' || !currentSong.videoId) {
    return null; // Sadece YouTube videoları için göster
  }

  const opts = {
    height: '390',
    width: '640',
    playerVars: {
      // https://developers.google.com/youtube/player_parameters
      autoplay: 1, // Otomatik oynatmayı etkinleştir
      controls: 1, // Kontrolleri göster
    },
  };

  return (
    <div className="youtube-player-container bg-black p-4 sticky top-0 z-50">
        <YouTube 
            videoId={currentSong.videoId} 
            opts={opts} 
            onStateChange={handleStateChange}
            onEnd={handleEnd}
            className="w-full aspect-video"
        />
    </div>
  );
};
