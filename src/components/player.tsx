'use client';
import React from 'react';
import ReactPlayer from 'react-player/lazy';
import { usePlayer } from '@/context/player-context';


export const Player = () => {
  const { 
    currentSong, 
    isPlaying,
    volume,
    isMuted,
    _playerSetIsPlaying,
    _playerSetProgress,
    _playerSetDuration,
    _playerOnEnd,
    _playerRegisterControls, // Bu artık doğrudan kullanılmayacak ama context'te kalabilir
  } = usePlayer();
  

  if (!currentSong) {
    return null;
  }

  // ReactPlayer tüm kaynakları (YouTube, SoundCloud, URL) tek başına yönetebilir.
  // Bu, farklı oynatıcılar arasındaki karmaşık mantığı ortadan kaldırır.
  return (
      <ReactPlayer
          key={currentSong.id}
          url={currentSong.url}
          playing={isPlaying}
          volume={volume}
          muted={isMuted}
          onPlay={() => _playerSetIsPlaying(true)}
          onPause={() => _playerSetIsPlaying(false)}
          onEnded={_playerOnEnd}
          onProgress={(state) => _playerSetProgress(state.playedSeconds)}
          onDuration={(duration) => _playerSetDuration(duration)}
          width="0"
          height="0"
          style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}
          config={{
            youtube: {
              playerVars: {
                // controls: 0, // Kontrolleri gizlemek için
                playsinline: 1,
              }
            },
            soundcloud: {
              options: {
                // SoundCloud seçenekleri
              }
            }
          }}
        />
  );
};
