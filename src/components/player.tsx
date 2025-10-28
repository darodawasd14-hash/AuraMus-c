'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import YouTube from 'react-youtube';
import { usePlayer } from '@/context/player-context';

// ### YOUTUBE PLAYER ###
const YouTubePlayerInternal = () => {
  const { currentSong, isPlaying, _setIsPlaying, playNext, seekTime, _seekTo, _setDuration, _setProgress, isSeeking } = usePlayer();
  const playerRef = useRef<any>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const onReady = useCallback((event: any) => {
    playerRef.current = event.target;
    if (isPlaying) {
      playerRef.current.playVideo();
    }
  }, [isPlaying]);

  const onStateChange = useCallback((event: any) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    if (event.data === 1) { // Playing
      _setIsPlaying(true);
      _setDuration(playerRef.current.getDuration());
      progressIntervalRef.current = setInterval(() => {
        if (playerRef.current && !isSeeking) {
          _setProgress(playerRef.current.getCurrentTime());
        }
      }, 250);
    } else if (event.data === 0) { // Ended
      _setIsPlaying(false);
      playNext();
    } else { // Paused, buffering, etc.
      _setIsPlaying(false);
    }
  }, [_setIsPlaying, _setDuration, _setProgress, playNext, isSeeking]);

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
    if (seekTime !== null && playerRef.current) {
      playerRef.current.seekTo(seekTime, true);
      _seekTo(null);
    }
  }, [seekTime, _seekTo]);
  
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
      className="w-0 h-0"
    />
  );
};


// ### SOUNDCLOUD PLAYER ###
const SoundCloudPlayerInternal = () => {
    const { currentSong, isPlaying, _setIsPlaying, _setDuration, _setProgress, playNext, seekTime, _seekTo, isSeeking } = usePlayer();
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
        
        // Ensure the iframe is loaded before creating the widget
        const widgetLoader = () => {
            iframe.src = `https://w.soundcloud.com/player/?url=${currentSong.url}&auto_play=${isPlaying}&visual=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false`;
            const widget = (window as any).SC.Widget(iframe);
            widgetRef.current = widget;

            const onReady = () => {
                widget.getDuration((d: number) => _setDuration(d / 1000));
                widget.bind((window as any).SC.Widget.Events.FINISH, playNext);
                widget.bind((window as any).SC.Widget.Events.PLAY, () => _setIsPlaying(true));
                widget.bind((window as any).SC.Widget.Events.PAUSE, () => _setIsPlaying(false));
                widget.bind((window as any).SC.Widget.Events.PLAY_PROGRESS, (data: { currentPosition: number }) => {
                    if (!isSeeking) _setProgress(data.currentPosition / 1000);
                });
            };
            widget.bind((window as any).SC.Widget.Events.READY, onReady);
        }

        if (iframe.contentWindow) {
           widgetLoader();
        } else {
            iframe.onload = widgetLoader;
        }

        return () => {
            if (widgetRef.current) {
                try {
                     widgetRef.current.unbind((window as any).SC.Widget.Events.READY);
                } catch (e) {
                    // ignore if widget is already destroyed
                }
            }
            if (iframe) {
                iframe.remove();
            }
        };
    }, [currentSong, _setDuration, playNext, _setIsPlaying, _setProgress, isSeeking, isPlaying]);


    useEffect(() => {
        const widget = widgetRef.current;
        if (widget) {
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
        if (seekTime !== null && widgetRef.current) {
            widgetRef.current.seekTo(seekTime * 1000);
            _seekTo(null);
        }
    }, [seekTime, _seekTo]);

    return null;
};


// ### URL (MP3) PLAYER ###
const UrlPlayerInternal = () => {
    const { currentSong, isPlaying, _setIsPlaying, _setDuration, _setProgress, playNext, seekTime, _seekTo, isSeeking } = usePlayer();
    
    useEffect(() => {
        if (!currentSong || currentSong.type !== 'url') return;
        
        const player = new Audio(currentSong.url);

        const handleDurationChange = () => {
            if (player.duration && isFinite(player.duration)) {
                _setDuration(player.duration);
            }
        };
        const handleTimeUpdate = () => {
            if (!isSeeking) _setProgress(player.currentTime);
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

        if (isPlaying) {
            player.play().catch(e => console.error("Audio playback failed:", e));
        } else {
            player.pause();
        }

        if (seekTime !== null) {
            player.currentTime = seekTime;
            _seekTo(null);
_seekTo(null);
        }

        return () => {
            player.removeEventListener('loadedmetadata', handleDurationChange);
            player.removeEventListener('durationchange', handleDurationChange);
            player.removeEventListener('timeupdate', handleTimeUpdate);
            player.removeEventListener('play', handlePlay);
            player.removeEventListener('pause', handlePause);
            player.removeEventListener('ended', handleEnded);
            player.pause();
            player.src = '';
        };
    }, [currentSong, isPlaying, seekTime, _setIsPlaying, _setDuration, _setProgress, _seekTo, playNext, isSeeking]);

    return null;
};


// ### ANA PLAYER BILEŞENİ ###
export function Player() {
  const { currentSong } = usePlayer();
  if (!currentSong) return null;

  const renderPlayer = () => {
    switch (currentSong.type) {
      case 'youtube':
        return <YouTubePlayerInternal />;
      case 'soundcloud':
        return <SoundCloudPlayerInternal />;
      case 'url':
        return <UrlPlayerInternal />;
      default:
        // This ensures a stable UI if song type is unknown
        console.warn(`Unknown song type: ${currentSong.type}`);
        return null;
    }
  };

  return (
    <div id="persistent-player-wrapper">
      {renderPlayer()}
    </div>
  );
}
