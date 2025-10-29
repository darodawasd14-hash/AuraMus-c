'use client';
import React, { useEffect } from 'react';
import ReactPlayer from 'react-player/lazy';
import { usePlayer } from '@/context/player-context';

export const Player = () => {
  const {
    currentSong,
    isPlaying,
    volume,
    isMuted,
    _playerOnReady,
    _playerOnProgress,
    _playerOnDuration,
    _playerOnEnded,
    playerRef
  } = usePlayer();

  useEffect(() => {
    // Bu useEffect, şarkı değiştiğinde oynatıcının doğru konuma atlamasını sağlar.
    // Özellikle bir şarkı bittiğinde veya kullanıcı listeden farklı bir şarkı seçtiğinde gereklidir.
    if (playerRef.current && currentSong) {
      // O anki `progress` değeriyle seek yapmaya çalışmak yerine,
      // şarkı değiştiğinde oynatıcının sıfırdan başlamasına izin vermek daha güvenilirdir.
      // ReactPlayer `url` prop'u değiştiğinde bunu otomatik olarak yönetir.
    }
  }, [currentSong, playerRef]);

  // Bu bileşen artık görünür bir şey render etmiyor, sadece mantığı çalıştırıyor.
  // Bu nedenle, currentSong yoksa bile render edilebilir, çünkü ReactPlayer
  // url null olduğunda bir şey yapmaz.
  return (
    <div className="player-wrapper" style={{ display: 'none' }}>
      <ReactPlayer
        ref={playerRef}
        url={currentSong?.url}
        playing={isPlaying}
        volume={volume}
        muted={isMuted}
        controls={false}
        width="100%"
        height="100%"
        onReady={_playerOnReady}
        onProgress={_playerOnProgress}
        onDuration={_playerOnDuration}
        onEnded={_playerOnEnded}
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
