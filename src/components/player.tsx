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
    playerRef,
    _playerOnReady,
    _playerOnProgress,
    _playerOnDuration,
    _playerOnEnded,
    _playerOnPlay,
    _playerOnPause,
  } = usePlayer();

  return (
    <div className="player-wrapper" style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
      {currentSong && (
          <ReactPlayer
            key={currentSong.id}
            ref={playerRef}
            url={currentSong.url}
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
            onPlay={_playerOnPlay}
            onPause={_playerOnPause}
            config={{
              youtube: {
                playerVars: { 
                  autoplay: 1, 
                  showinfo: 0,
                  disablekb: 1,
                  iv_load_policy: 3,
                  rel: 0,
                  controls: 0,
                }
              },
              soundcloud: {
                options: {
                  visual: false,
                  autoplay: true,
                }
              }
            }}
          />
      )}
    </div>
  );
};
