'use client';
import React, { useContext, useState, useEffect } from 'react';
import YouTube from 'react-youtube';
import { usePlayer } from '@/context/player-context';

export function Player() {
  const { currentSong, isPlaying, playNext, _setIsPlaying, _setProgress, _setDuration } = usePlayer();

  const [player, setPlayer] = useState<any>(null);

  const handleOnReady = (event: { target: any }) => {
    setPlayer(event.target);
  };

  useEffect(() => {
    if (!player) {
      return;
    }

    if (isPlaying) {
      player.playVideo();
    } else {
      if (player && typeof player.pauseVideo === 'function') {
        player.pauseVideo();
      }
    }
  }, [isPlaying, player]);

  if (!currentSong || currentSong.type !== 'youtube' || !currentSong.videoId) {
    return null;
  }
  
  const onPlayerStateChange = (event: { data: number; }) => {
    // State 1: Playing
    if (event.data === 1) {
      _setIsPlaying(true);
    } 
    // State 2: Paused
    else if (event.data === 2) {
      _setIsPlaying(false);
    }
     // State 0: Ended
    else if (event.data === 0) {
      _setIsPlaying(false);
      playNext();
    } else {
      // For other states like buffering, unstarted, etc.
      _setIsPlaying(false);
    }
  };


  const opts = {
    height: '0',
    width: '0',
    playerVars: {
      autoplay: 0,
      controls: 0,
      playsinline: 1,
    },
  };

  return (
    <div className="absolute top-[-9999px] left-[-9999px] w-0 h-0">
        <YouTube
        videoId={currentSong.videoId}
        opts={opts}
        onReady={handleOnReady}
        onStateChange={onPlayerStateChange}
        onEnd={playNext}
        />
    </div>
  );
};
