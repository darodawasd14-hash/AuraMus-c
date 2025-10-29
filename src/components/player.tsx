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

  // The Player is now always rendered in the background. It is the "engine"
  // that handles all playback, but it's not directly visible.
  // The 'PlaylistView' component will show a visual representation (like an iframe).
  // The key is to let this player autoplay silently to get the progress bar moving,
  // while the visible player waits for interaction.
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
                  // autoplay: 1 is crucial for this flow to work, as it allows the player to start
                  // silently, which then allows us to control it programmatically.
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
