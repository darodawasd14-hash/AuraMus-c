'use client';
import React, { useContext } from 'react';
import ReactPlayer from 'react-player/lazy';
import { PlayerContext } from '@/context/player-context';

/**
 * This is the "Motor" of the player.
 * It's an invisible component that lives at the top level of the app.
 * Its only job is to play the audio and report its status back to the PlayerContext.
 * All UI controls interact with the context, not directly with this component.
 */
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
  } = useContext(PlayerContext)!;

  return (
    // This player is hidden. It only produces sound. The visual part is in AuraApp.
    <div className="player-wrapper" style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
      {currentSong && (
          <ReactPlayer
            key={currentSong.id}
            ref={playerRef}
            url={currentSong.url}
            playing={isPlaying}
            volume={volume}
            muted={isMuted}
            controls={false} // Hidden player never shows controls
            width="1px"
            height="1px"
            onReady={_playerOnReady}
            onProgress={_playerOnProgress}
            onDuration={_playerOnDuration}
            onEnded={_playerOnEnded}
            onPlay={_playerOnPlay}
            onPause={_playerOnPause}
            config={{
              youtube: {
                playerVars: { 
                  // Autoplay is essential for the seamless experience
                  autoplay: 1, 
                  // Hide all YouTube UI elements
                  showinfo: 0,
                  disablekb: 1,
                  iv_load_policy: 3,
                  modestbranding: 1,
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
