'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import YouTube from 'react-youtube';
import { usePlayer } from '@/context/player-context';

const YouTubePlayerInternal = () => {
  const { currentSong, isPlaying, playNext, _setIsPlaying, _setDuration, _setProgress, seekTime, _clearSeek } = usePlayer();
  const playerRef = useRef<any>(null);

  const onReady = useCallback((event: any) => {
    playerRef.current = event.target;
    // TEST: Mute the player first to see if autoplay policy is the issue
    event.target.mute(); 
    // Then try to play. If it plays silently, we've confirmed the issue.
    event.target.playVideo();
  }, []);

  const onStateChange = useCallback((event: any) => {
    if (playerRef.current) {
        const duration = playerRef.current.getDuration();
        if (duration) {
            _setDuration(duration);
        }
    }
    
    if (event.data === 1) { // Playing
      _setIsPlaying(true);
    } else if (event.data === 0) { // Ended
      _setIsPlaying(false);
      playNext();
    } else { // Paused, buffering, etc.
      _setIsPlaying(false);
    }
  }, [_setIsPlaying, _setDuration, playNext]);

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
    }
    if (isPlaying && playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        progressIntervalRef.current = setInterval(() => {
            const progress = playerRef.current.getCurrentTime();
            if (typeof progress === 'number') {
                _setProgress(progress);
            }
        }, 250);
    }

    return () => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
        }
    };
  }, [isPlaying, _setProgress]);
  
  useEffect(() => {
    const player = playerRef.current;
    if (player && typeof player.getPlayerState === 'function') {
      if (isPlaying) {
        player.playVideo();
      } else {
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

  if (!currentSong || currentSong.type !== 'youtube' || !currentSong.videoId) return null;

  return (
    <YouTube
      key={currentSong.id}
      videoId={currentSong.videoId}
      opts={{
        width: '1', // Positioned off-screen
        height: '1',
        playerVars: {
          autoplay: 1, 
          controls: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1
        },
      }}
      onReady={onReady}
      onStateChange={onStateChange}
      onError={(e) => console.error('YouTube Player Error:', e)}
      className="absolute top-[-9999px] left-[-9999px] opacity-0"
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
            iframe.style.position = 'absolute';
            iframe.style.top = '-9999px';
            iframe.style.left = '-9999px';
            iframe.style.width = '1px';
            iframe.style.height = '1px';
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
                     widgetRef.current.unbind((window as a-ny).SC.Widget.Events.FINISH);
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
            if (isPlaying) {
                widget.play();
            } else {
                widget.pause();
            }
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
    const audioRef = useRef<HTMLAudioElement | null>(null);
    
    useEffect(() => {
        let player = audioRef.current;
        if (!currentSong || currentSong.type !== 'url' || !currentSong.url) {
            if (player) {
                player.pause();
                player.src = '';
            }
            return;
        }
        
        if (!player) {
            player = new Audio();
            audioRef.current = player;
        }

        if(player.src !== currentSong.url) {
            player.src = currentSong.url;
        }

        const handleLoadedMetadata = () => {
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

        player.addEventListener('loadedmetadata', handleLoadedMetadata);
        player.addEventListener('timeupdate', handleTimeUpdate);
        player.addEventListener('play', handlePlay);
        player.addEventListener('pause', handlePause);
        player.addEventListener('ended', handleEnded);

        return () => {
            if(player) {
                player.removeEventListener('loadedmetadata', handleLoadedMetadata);
                player.removeEventListener('timeupdate', handleTimeUpdate);
                player.removeEventListener('play', handlePlay);
                player.removeEventListener('pause', handlePause);
                player.removeEventListener('ended', handleEnded);
            }
        };
    }, [currentSong, _setDuration, _setProgress, _setIsPlaying, playNext, isSeeking]);

     useEffect(() => {
        const player = audioRef.current;
        if (!player) return;

        if (seekTime !== null) {
            player.currentTime = seekTime;
            _clearSeek();
        }

        if (isPlaying) {
            player.play().catch(e => console.error("Audio playback failed:", e));
        } else {
            player.pause();
        }
    }, [isPlaying, seekTime, _clearSeek]);

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
