'use client';
import React, { useEffect, useRef, useCallback } from 'react';
import YouTube, { YouTubePlayer, Options as YouTubeOptions } from 'react-youtube';
import ReactPlayer from 'react-player';
import { usePlayer } from '@/context/player-context';


export const Player = () => {
  const { 
    currentSong, 
    isPlaying,
    _playerSetIsPlaying,
    _playerSetProgress,
    _playerSetDuration,
    _playerOnEnd,
    _playerRegisterControls,
  } = usePlayer();
  
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const reactPlayerRef = useRef<ReactPlayer | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  },[]);
  
  const startYoutubeProgressTracking = useCallback(() => {
    stopProgressTracking();
    progressIntervalRef.current = setInterval(() => {
        if (youtubePlayerRef.current) {
            const player = youtubePlayerRef.current;
            if (typeof player.getCurrentTime === 'function' && typeof player.getDuration === 'function') {
                const currentTime = player.getCurrentTime();
                const duration = player.getDuration();
                 if (duration > 0) { // Only update if duration is valid
                    _playerSetProgress(currentTime);
                    _playerSetDuration(duration);
                }
            }
        }
    }, 500);
  }, [_playerSetProgress, _playerSetDuration, stopProgressTracking]);


  useEffect(() => {
    _playerRegisterControls({
      seek: (time) => {
        if (currentSong?.type === 'youtube' && youtubePlayerRef.current) {
          youtubePlayerRef.current.seekTo(time, true);
        } else if (reactPlayerRef.current) {
          reactPlayerRef.current.seekTo(time, 'seconds');
        }
      },
      unmute: () => {
        if (currentSong?.type === 'youtube' && youtubePlayerRef.current && youtubePlayerRef.current.isMuted()) {
          youtubePlayerRef.current.unMute();
        }
        // ReactPlayer's volume is controlled by props, context handles it
      }
    });
  }, [_playerRegisterControls, currentSong?.type]);


  useEffect(() => {
    if (currentSong?.type === 'youtube' && youtubePlayerRef.current) {
      const player = youtubePlayerRef.current;
      if (isPlaying) {
        player.playVideo();
      } else {
        player.pauseVideo();
      }
    }
  }, [isPlaying, currentSong?.type]);

  const handleYoutubeReady = (event: { target: YouTubePlayer }) => {
    youtubePlayerRef.current = event.target;
    youtubePlayerRef.current.setVolume(75); // Set a default volume
    youtubePlayerRef.current.mute(); // Mute by default to allow autoplay
    if (currentSong?.videoId) {
        // When ready, load and play the video. It will autoplay because it's muted.
        youtubePlayerRef.current.loadVideoById(currentSong.videoId);
        youtubePlayerRef.current.playVideo();
    }
  };
  
  const handleYoutubeStateChange = (event: { data: number }) => {
    if (event.data === YouTube.PlayerState.PLAYING) {
      _playerSetIsPlaying(true);
      startYoutubeProgressTracking();
    } else if (event.data === YouTube.PlayerState.PAUSED) {
      _playerSetIsPlaying(false);
      stopProgressTracking();
    } else if (event.data === YouTube.PlayerState.ENDED) {
      _playerOnEnd();
    }
  }

  const handleReactPlayerReady = (player: ReactPlayer) => {
    reactPlayerRef.current = player;
  }

  const handleReactPlayerProgress = (state: { playedSeconds: number }) => {
      _playerSetProgress(state.playedSeconds);
      if(reactPlayerRef.current) {
        _playerSetDuration(reactPlayerRef.current.getDuration());
      }
  }

  if (!currentSong) {
    return null;
  }

  const youtubeOpts: YouTubeOptions = {
    height: '0',
    width: '0',
    playerVars: {
      autoplay: 0, // We control playback manually
      controls: 0,
      playsinline: 1,
      mute: 1 // Start muted to ensure autoplay works
    },
  };
  
  const renderPlayer = () => {
    switch(currentSong.type) {
        case 'youtube':
            return (
                <YouTube
                    key={currentSong.id} // Add key to force re-render on song change
                    videoId={currentSong.videoId}
                    opts={youtubeOpts}
                    onReady={handleYoutubeReady}
                    onStateChange={handleYoutubeStateChange}
                    onEnd={_playerOnEnd}
                    onError={(e) => console.error('YouTube Player Error:', e)}
                    className="absolute top-[-9999px] left-[-9999px]"
                />
            );
        case 'soundcloud':
        case 'url':
            return (
                <ReactPlayer
                    key={currentSong.id} // Add key to force re-render
                    ref={reactPlayerRef}
                    url={currentSong.url}
                    playing={isPlaying}
                    onPlay={() => _playerSetIsPlaying(true)}
                    onPause={() => _playerSetIsPlaying(false)}
                    onEnded={_playerOnEnd}
                    onProgress={handleReactPlayerProgress}
                    onDuration={(d) => _playerSetDuration(d)}
                    onReady={handleReactPlayerReady}
                    width="0"
                    height="0"
                    style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}
                />
            );
        default:
            return null;
    }
  }

  return renderPlayer();
};
