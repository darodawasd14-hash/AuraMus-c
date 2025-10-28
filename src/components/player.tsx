'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import YouTube from 'react-youtube';
import { usePlayer } from '@/context/player-context';

// This is the "Motor" component.
// Its only job is to listen to the "Brain" (PlayerContext) and control the players.
// It also reports back the player's real status to the "Brain".

const YouTubePlayerInternal = () => {
  const { currentSong, isPlaying, playNext, seekTime, _clearSeek, _setIsPlaying, _setDuration, _setProgress } = usePlayer();
  const playerRef = useRef<any>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const onReady = useCallback((event: any) => {
    playerRef.current = event.target;
    // On ready, get duration and if the intent is to play, start playing.
    const duration = playerRef.current.getDuration();
    if (duration) {
      _setDuration(duration);
    }
    if (isPlaying) {
      playerRef.current.playVideo();
    }
  }, [isPlaying, _setDuration]);

  const onStateChange = useCallback((event: any) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    // The player's state changed, so we report back to the context.
    if (event.data === 1) { // Playing
      _setIsPlaying(true);
      const duration = playerRef.current.getDuration();
       if (duration) {
        _setDuration(duration);
      }
      progressIntervalRef.current = setInterval(() => {
        if (playerRef.current) {
          const progress = playerRef.current.getCurrentTime();
          _setProgress(progress);
        }
      }, 250);
    } else if (event.data === 0) { // Ended
      _setIsPlaying(false);
      playNext();
    } else { // Paused, buffering, etc.
      _setIsPlaying(false);
    }
  }, [_setIsPlaying, _setDuration, _setProgress, playNext]);
  
  useEffect(() => {
    const player = playerRef.current;
    if (player && typeof player.getPlayerState === 'function') {
      const playerState = player.getPlayerState();
      if (isPlaying && playerState !== 1) {
        player.playVideo();
      } else if (!isPlaying && playerState === 1) {
        player.pauseVideo();
      }
    }
  }, [isPlaying, currentSong]);

  useEffect(() => {
    if (seekTime !== null && playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(seekTime, true);
      _clearSeek(); 
    }
  }, [seekTime, _clearSeek]);
  
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  if (!currentSong || currentSong.type !== 'youtube' || !currentSong.videoId) return null;

  return (
    <YouTube
      key={currentSong.id}
      videoId={currentSong.videoId}
      opts={{
        width: '0',
        height: '0',
        playerVars: {
          autoplay: 1, 
          controls: 0,
          modestbranding: 1,
          rel: 0,
        },
      }}
      onReady={onReady}
      onStateChange={onStateChange}
      className="hidden"
    />
  );
};

const SoundCloudPlayerInternal = () => {
    const { currentSong, isPlaying, playNext, seekTime, _clearSeek, _setIsPlaying, _setDuration, _setProgress, isSeeking } = usePlayer();
    const widgetRef = useRef<any>(null);

    useEffect(() => {
        if (!currentSong || currentSong.type !== 'soundcloud' || !(window as any).SC) return;

        const iframeId = `soundcloud-player-${currentSong.id}`;
        let iframe = document.getElementById(iframeId) as HTMLIFrameElement;
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = iframeId;
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
        }
        
        iframe.src = `https://w.soundcloud.com/player/?url=${currentSong.url}&auto_play=false&visual=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false`;
        
        const widget = (window as any).SC.Widget(iframe);
        widgetRef.current = widget;

        const onReady = () => {
            widget.getDuration((d: number) => _setDuration(d / 1000));
            if (isPlaying) {
                widget.play();
            }
        };

        const onPlay = () => _setIsPlaying(true);
        const onPause = () => _setIsPlaying(false);
        const onFinish = () => playNext();
        const onPlayProgress = (data: { currentPosition: number }) => {
            if (!isSeeking) {
                _setProgress(data.currentPosition / 1000);
            }
        };

        widget.bind((window as any).SC.Widget.Events.READY, onReady);
        widget.bind((window as any).SC.Widget.Events.PLAY, onPlay);
        widget.bind((window as any).SC.Widget.Events.PAUSE, onPause);
        widget.bind((window as any).SC.Widget.Events.FINISH, onFinish);
        widget.bind((window as any).SC.Widget.Events.PLAY_PROGRESS, onPlayProgress);

        return () => {
            if (widgetRef.current) {
                try {
                     widgetRef.current.unbind((window as any).SC.Widget.Events.READY);
                     widgetRef.current.unbind((window as any).SC.Widget.Events.PLAY);
                     widgetRef.current.unbind((window as any).SC.Widget.Events.PAUSE);
                     widgetRef.current.unbind((window as any).SC.Widget.Events.FINISH);
                     widgetRef.current.unbind((window as any).SC.Widget.Events.PLAY_PROGRESS);
                } catch (e) {}
            }
            if (iframe) {
                iframe.remove();
            }
        };
    }, [currentSong, _setDuration, playNext, _setIsPlaying, _setProgress, isSeeking, isPlaying]);

    useEffect(() => {
        const widget = widgetRef.current;
        if (widget && typeof widget.isPaused === 'function') {
            widget.isPaused((paused: boolean) => {
                if (isPlaying && paused) {
                    widget.play();
                } else if (!isPlaying && !paused) {
                    widget.pause();
                }
            });
        }
    }, [isPlaying]);

    useEffect(() => {
        if (seekTime !== null && widgetRef.current && typeof widgetRef.current.seekTo === 'function') {
            widgetRef.current.seekTo(seekTime * 1000);
            _clearSeek();
        }
    }, [seekTime, _clearSeek]);

    return null;
};


const UrlPlayerInternal = () => {
    const { currentSong, isPlaying, playNext, seekTime, _clearSeek, _setIsPlaying, _setDuration, _setProgress, isSeeking } = usePlayer();
    
    useEffect(() => {
        if (!currentSong || currentSong.type !== 'url' || !currentSong.url) {
            return;
        }

        let player: HTMLAudioElement | null = new Audio(currentSong.url);

        const handleDurationChange = () => {
            if (player && player.duration && isFinite(player.duration)) {
                _setDuration(player.duration);
            }
        };
        const handleTimeUpdate = () => {
            if (player && !isSeeking) {
                _setProgress(player.currentTime);
            }
        };
        const handlePlay = () => _setIsPlaying(true);
        const handlePause = () => _setIsPlaying(false);
        const handleEnded = () => playNext();

        player.addEventListener('loadedmetadata', handleDurationChange);
        player.addEventListener('durationchange', handleDurationChange);
        player.addEventListener('timeupdate', handleTimeUpdate);
        player.addEventListener('play', handlePlay);
        player.addEventListener('pause', handlePause);
        player.addEventListener('ended', handleEnded);

        if (seekTime !== null) {
            player.currentTime = seekTime;
            _clearSeek();
        }

        if (isPlaying) {
            player.play().catch(e => console.error("Audio playback failed:", e));
        } else {
            player.pause();
        }

        return () => {
            if(player) {
                player.removeEventListener('loadedmetadata', handleDurationChange);
                player.removeEventListener('durationchange', handleDurationChange);
                player.removeEventListener('timeupdate', handleTimeUpdate);
                player.removeEventListener('play', handlePlay);
                player.removeEventListener('pause', handlePause);
                player.removeEventListener('ended', handleEnded);
                player.pause();
                player.src = '';
                player = null;
            }
        };
    }, [currentSong, isPlaying, seekTime, _setIsPlaying, _setDuration, _setProgress, _clearSeek, playNext, isSeeking]);

    return null;
};


export function Player() {
  const { currentSong } = usePlayer();
  if (!currentSong) return null;

  switch (currentSong.type) {
    case 'youtube':
      return <YouTubePlayerInternal />;
    case 'soundcloud':
      return <SoundCloudPlayerInternal />;
    case 'url':
      return <UrlPlayerInternal />;
    default:
      console.warn(`Unknown song type: ${currentSong.type}`);
      return null;
  }
}
