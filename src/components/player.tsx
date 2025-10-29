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

  // The Player is now always rendered in the background, but only plays
  // when currentSong is not null. It's visually hidden via CSS/styling.
  // The UI for playback (play/pause overlay) is handled in PlaylistView.
  return (
    <div className="player-wrapper" style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
      {currentSong && (
          <ReactPlayer
            key={currentSong.id} // Important for re-mounting when song changes
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
