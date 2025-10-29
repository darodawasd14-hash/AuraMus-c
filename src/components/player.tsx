'use client';
import React, { useEffect, useRef, useCallback } from 'react';
import YouTube, { YouTubePlayer, Options as YouTubeOptions } from 'react-youtube';
import ReactPlayer from 'react-player';
import { usePlayer } from '@/context/player-context';


export const Player = () => {
  const { 
    currentSong, 
    isPlaying,
    volume,
    isMuted,
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
            if (player && typeof player.getCurrentTime === 'function' && typeof player.getDuration === 'function') {
                const currentTime = player.getCurrentTime();
                const duration = player.getDuration();
                 if (duration > 0) {
                    _playerSetProgress(currentTime);
                    _playerSetDuration(duration);
                }
            }
        }
    }, 500);
  }, [_playerSetProgress, _playerSetDuration, stopProgressTracking]);


  useEffect(() => {
    _playerRegisterControls({
      play: () => {
        if (currentSong?.type === 'youtube' && youtubePlayerRef.current) {
          youtubePlayerRef.current.playVideo();
        } else if (reactPlayerRef.current) {
          // ReactPlayer is controlled via props, this is handled by `isPlaying`
        }
      },
      pause: () => {
        if (currentSong?.type === 'youtube' && youtubePlayerRef.current) {
          youtubePlayerRef.current.pauseVideo();
        } else if (reactPlayerRef.current) {
           // ReactPlayer is controlled via props, this is handled by `isPlaying`
        }
      },
      seek: (time) => {
        if (currentSong?.type === 'youtube' && youtubePlayerRef.current) {
          youtubePlayerRef.current.seekTo(time, true);
        } else if (reactPlayerRef.current) {
          reactPlayerRef.current.seekTo(time, 'seconds');
        }
      },
      setVolume: (newVolume) => {
        if (currentSong?.type === 'youtube' && youtubePlayerRef.current) {
          youtubePlayerRef.current.setVolume(newVolume * 100);
        }
        // ReactPlayer's volume is controlled by props
      },
      mute: () => {
        if (currentSong?.type === 'youtube' && youtubePlayerRef.current) {
          youtubePlayerRef.current.mute();
        }
        // ReactPlayer's mute is controlled by props
      },
      unmute: () => {
        if (currentSong?.type === 'youtube' && youtubePlayerRef.current) {
          youtubePlayerRef.current.unMute();
        }
        // ReactPlayer's mute is controlled by props
      }
    });
  }, [_playerRegisterControls, currentSong?.type]);


  const handleYoutubeReady = (event: { target: YouTubePlayer }) => {
    youtubePlayerRef.current = event.target;
    // Oynatıcı hazır olduğunda, Context'ten gelen isPlaying durumuna göre
    // ve tarayıcı politikaları için sessiz bir şekilde oynatmayı dene.
    event.target.setVolume(volume * 100);
    if(isMuted) {
        event.target.mute();
    }
    if(isPlaying) {
      event.target.playVideo();
    }
  };
  
  const handleYoutubeStateChange = (event: { data: number }) => {
    const playerState = event.data;
    if (playerState === YouTube.PlayerState.PLAYING) {
      _playerSetIsPlaying(true);
      startYoutubeProgressTracking();
    } else if (playerState === YouTube.PlayerState.PAUSED || playerState === YouTube.PlayerState.CUED) {
      _playerSetIsPlaying(false);
      stopProgressTracking();
    } else if (playerState === YouTube.PlayerState.ENDED) {
      _playerSetIsPlaying(false);
      _playerOnEnd();
      stopProgressTracking();
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
    stopProgressTracking();
    if(youtubePlayerRef.current && typeof youtubePlayerRef.current.stopVideo === 'function'){
      youtubePlayerRef.current.stopVideo();
    }
    return null;
  }

  const youtubeOpts: YouTubeOptions = {
    height: '0',
    width: '0',
    playerVars: {
      autoplay: 1, 
      controls: 0,
      playsinline: 1,
    },
  };
  
  const renderPlayer = () => {
    switch(currentSong.type) {
        case 'youtube':
            return (
                <YouTube
                    key={currentSong.id} // Şarkı değiştiğinde oynatıcıyı yeniden oluşturur
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
                    key={currentSong.id}
                    ref={reactPlayerRef}
                    url={currentSong.url}
                    playing={isPlaying}
                    volume={volume}
                    muted={isMuted}
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
