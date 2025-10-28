'use client';

import React, { useEffect, useRef } from 'react';
import { usePlayer } from '@/context/player-context';
import YouTube, { YouTubePlayer, Options } from 'react-youtube';

/**
 * The main Player component. It renders the correct internal player engine
 * based on the current song's type. This component is the "Motor" and is
 * responsible for all direct interactions with the player libraries.
 */
export function Player() {
  const { currentSong, _setIsPlaying, playNext, _setProgress, _setDuration } = usePlayer();

  // Render the correct player based on song type
  if (!currentSong) return null;

  switch (currentSong.type) {
    case 'youtube':
      return (
        <YouTubePlayerInternal
          song={currentSong}
          onEnd={playNext}
          onStateChange={_setIsPlaying}
          onProgress={_setProgress}
          onDuration={_setDuration}
        />
      );
    // TODO: Add SoundCloud and URL players here in the future
    case 'soundcloud':
    case 'url':
    default:
      return null;
  }
}

// --- Internal Player Engines ---

interface YouTubePlayerInternalProps {
  song: { videoId?: string };
  onEnd: () => void;
  onStateChange: (isPlaying: boolean) => void;
  onProgress: (progress: number) => void;
  onDuration: (duration: number) => void;
}

function YouTubePlayerInternal({ song, onEnd, onStateChange, onProgress, onDuration }: YouTubePlayerInternalProps) {
  const { isPlaying, isMuted, volume, seekTime, _clearSeek, isSeeking } = usePlayer();
  const playerRef = useRef<YouTubePlayer | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { videoId } = song;

  // Guard clause: If there's no videoId, don't render the player.
  if (!videoId) return null;
  
  const startProgressTracking = (player: YouTubePlayer) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    progressIntervalRef.current = setInterval(() => {
      // Only update progress if the user is not actively seeking
      if (!isSeeking) {
         onProgress(player.getCurrentTime());
      }
    }, 500); // Update progress every 500ms
  };
  
  const stopProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
  };

  const onReady = (event: { target: YouTubePlayer }) => {
    playerRef.current = event.target;
    onDuration(event.target.getDuration());
    event.target.mute(); // Mute by default to comply with autoplay policies
    event.target.playVideo(); // Start playing automatically (muted)
    startProgressTracking(event.target); // Start tracking as soon as the player is ready
  };
  
  const onPlayerStateChange = (event: { data: number; target: YouTubePlayer }) => {
    // State 1: Playing
    if (event.data === 1) {
      onStateChange(true);
      // Ensure tracking is running when playing
      startProgressTracking(event.target);
    } 
    // State 2: Paused
    else if (event.data === 2) {
      onStateChange(false);
      // Stop tracking when paused to save resources
      stopProgressTracking();
    }
     // State 0: Ended
    else if (event.data === 0) {
      onStateChange(false);
      stopProgressTracking();
      onEnd();
    } else {
      // For other states like buffering, unstarted, etc.
      onStateChange(false);
    }
  };
  
  // Effect for Play/Pause
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    if (isPlaying) {
      player.playVideo();
      // When user intends to play, ensure we unmute
      if (player.isMuted()) {
        player.unMute();
      }
    } else {
      player.pauseVideo();
    }
  }, [isPlaying]);

  // Effect for Mute/Unmute & Volume
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    
    if (isMuted) {
      player.mute();
    } else {
      player.unMute();
      // Volume is 0-100 for YouTube API
      player.setVolume(volume * 100);
    }
  }, [isMuted, volume]);

  // Effect for Seeking
  useEffect(() => {
    if (seekTime !== null) {
      const player = playerRef.current;
      if (player) {
        player.seekTo(seekTime, true);
      }
      _clearSeek(); // Reset seek time after handling it
    }
  }, [seekTime, _clearSeek]);

  const opts: Options = {
      height: '0',
      width: '0',
      playerVars: {
        // autoplay: 1, // Let onReady handle autoplay
        controls: 0,
        playsinline: 1,
        // modestbranding: 1,
        // rel: 0, 
      },
    }

  return (
    <div className="absolute top-[-9999px] left-[-9999px] w-0 h-0">
      <YouTube
        videoId={videoId}
        opts={opts}
        onReady={onReady}
        onStateChange={onPlayerStateChange}
        onEnd={onEnd}
      />
    </div>
  );
}
