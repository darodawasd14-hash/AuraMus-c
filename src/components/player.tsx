'use client';
import React, { useEffect, useRef } from 'react';
import YouTube, { YouTubePlayer } from 'react-youtube';
import { usePlayer } from '@/context/player-context';

let playerRef: YouTubePlayer | null = null;
let progressIntervalRef: NodeJS.Timeout | null = null;

export const Player = () => {
  const { 
    currentSong, 
    isPlaying, 
    playNext,
    _setIsPlaying,
    _setProgress,
    _setDuration
  } = usePlayer();
  
  const isSeeking = useRef(false); // Use ref to avoid re-renders on seek

  const stopProgressTracking = () => {
    if (progressIntervalRef) {
      clearInterval(progressIntervalRef);
      progressIntervalRef = null;
    }
  };

  const startProgressTracking = (player: YouTubePlayer) => {
    stopProgressTracking(); // Stop any existing tracker
    progressIntervalRef = setInterval(() => {
      if (player && typeof player.getCurrentTime === 'function' && !isSeeking.current) {
        _setProgress(player.getCurrentTime());
        _setDuration(player.getDuration());
      }
    }, 500);
  };

  const handleOnReady = (event: { target: YouTubePlayer }) => {
    playerRef = event.target;
    playerRef.setVolume(75); // Set a default volume
    if (currentSong && isPlaying) {
        playerRef.playVideo();
    }
  };
  
  const handleOnStateChange = (event: { data: number }) => {
    const playerState = event.data;
    if (playerState === YouTube.PlayerState.PLAYING) {
      _setIsPlaying(true);
      startProgressTracking(event.target);
    } else if (playerState === YouTube.PlayerState.PAUSED) {
      _setIsPlaying(false);
      stopProgressTracking();
    } else if (playerState === YouTube.PlayerState.ENDED) {
      playNext();
    }
  }

  useEffect(() => {
    if (!playerRef) return;

    if (isPlaying) {
      playerRef.playVideo();
    } else {
      if (playerRef && typeof playerRef.pauseVideo === 'function') {
        playerRef.pauseVideo();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (currentSong && playerRef && currentSong.videoId) {
      playerRef.loadVideoById(currentSong.videoId);
      if (isPlaying) {
        playerRef.playVideo();
      }
    }
     return () => {
      stopProgressTracking();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong]);

  if (!currentSong || currentSong.type !== 'youtube' || !currentSong.videoId) {
    return null;
  }

  const opts = {
    height: '0',
    width: '0',
    playerVars: {
      autoplay: 1, // Let's try to autoplay, browser might block it
      controls: 0,
      playsinline: 1
    },
  };

  return (
      <YouTube
        videoId={currentSong.videoId}
        opts={opts}
        onReady={handleOnReady}
        onStateChange={handleOnStateChange}
        onEnd={playNext}
        onError={(e) => console.error('YouTube Player Error:', e)}
        className="absolute top-[-9999px] left-[-9999px] w-0 h-0"
      />
  );
};
