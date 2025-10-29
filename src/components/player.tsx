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
    hasInteracted,
    _playerOnReady,
    _playerOnProgress,
    _playerOnDuration,
    _playerOnEnded,
    _playerOnPlay,
    _playerOnPause,
    playerRef
  } = usePlayer();

  useEffect(() => {
    if (playerRef.current && currentSong) {
      // This effect is no longer needed for seeking, as ReactPlayer handles URL changes automatically.
      // It can be kept for any future logic if necessary.
    }
  }, [currentSong, playerRef]);

  // The hidden player that acts as the "engine" for the entire app.
  // It is directly controlled by the state from the PlayerContext.
  return (
    <div className="player-wrapper" style={{ display: 'none' }}>
      <ReactPlayer
        ref={playerRef} // Connect the ref from the context to this player instance.
        url={currentSong?.url}
        playing={isPlaying && hasInteracted} // Only play if user has interacted
        volume={volume}
        muted={isMuted}
        controls={false}
        width="100%"
        height="100%"
        onReady={_playerOnReady}
        onProgress={_playerOnProgress}
        onDuration={_playerOnDuration} // Report the duration to the context.
        onEnded={_playerOnEnded}
        onPlay={_playerOnPlay}
        onPause={_playerOnPause}
        config={{
          youtube: {
            playerVars: { 
              autoplay: 0, // IMPORTANT: Autoplay is handled by our context logic now
              showinfo: 0,
              disablekb: 1,
              iv_load_policy: 3,
            }
          },
          soundcloud: {
            options: {
              visual: false,
              autoplay: false, // Turn off SC autoplay too
            }
          }
        }}
      />
    </div>
  );
};
