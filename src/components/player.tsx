'use client';
import React, { useRef, useEffect } from 'react';
import ReactPlayer from 'react-player/lazy';
import { usePlayer } from '@/context/player-context';

export const Player = () => {
  const {
    currentSong,
    isPlaying,
    volume,
    isMuted,
    _playerSetIsPlaying,
    _playerOnProgress,
    _playerOnDuration,
    _playerOnEnded,
    _playerSetReady,
  } = usePlayer();
  const playerRef = useRef<ReactPlayer>(null);

  // Oynatıcıyı dışarıdan kontrol etmek için (örneğin sonraki şarkıya geçme)
  useEffect(() => {
    if (currentSong && playerRef.current) {
        // Bu, şarkı değiştiğinde oynatıcının doğru konuma atlamasını sağlar.
        // Genellikle ReactPlayer bunu otomatik yapar ama bir güvence katmanı.
    }
  }, [currentSong]);


  if (!currentSong) {
    return null; // Çalacak şarkı yoksa oynatıcıyı render etme
  }

  return (
    <div className="player-wrapper" style={{ display: 'none' }}>
      <ReactPlayer
        ref={playerRef}
        url={currentSong.url}
        playing={isPlaying}
        volume={volume}
        muted={isMuted}
        controls={false} // Kendi kontrollerimizi kullanacağız
        width="100%"
        height="100%"
        onReady={() => _playerSetReady(true)}
        onStart={() => _playerSetIsPlaying(true)}
        onPlay={() => _playerSetIsPlaying(true)}
        onPause={() => _playerSetIsPlaying(false)}
        onBuffer={() => { /* Belki bir yükleniyor göstergesi için */ }}
        onEnded={_playerOnEnded}
        onProgress={_playerOnProgress}
        onDuration={_playerOnDuration}
        config={{
          youtube: {
            playerVars: { 
              showinfo: 0,
              disablekb: 1,
              iv_load_policy: 3,
            }
          },
          soundcloud: {
            options: {
              visual: false,
            }
          }
        }}
      />
    </div>
  );
};
