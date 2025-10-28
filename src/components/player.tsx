'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import YouTube from 'react-youtube';
import { usePlayer } from '@/context/player-context';

const YouTubePlayerInternal = () => {
  const {
    currentSong,
    isPlaying,
    isMuted,
    seekTime,
    playNext,
    _setIsPlaying,
    _setDuration,
    _setProgress,
    _clearSeek,
    _setIsMuted,
    isSeeking,
  } = usePlayer();
  
  const playerRef = useRef<any>(null);

  // CRITICAL FIX: Guard Clause at the render level.
  // If there's no song or no videoId, render nothing. This prevents
  // the useEffect hooks from running with null data.
  if (!currentSong || currentSong.type !== 'youtube' || !currentSong.videoId) {
    return null;
  }

  const onReady = useCallback((event: any) => {
    playerRef.current = event.target;
    // Mute on ready to comply with browser autoplay policies.
    // The user will unmute via interaction.
    playerRef.current.mute();
    _setIsMuted(true);
    if (isPlaying) {
      playerRef.current.playVideo();
    }
  }, [_setIsMuted, isPlaying]);

  const onStateChange = useCallback((event: any) => {
    // Guard Clause: Don't do anything if the player is not ready.
    const player = playerRef.current;
    if (!player) return;

    // Sync duration and mute state from the player.
    const duration = player.getDuration();
    if (duration) _setDuration(duration);
    _setIsMuted(player.isMuted());
    
    const playerState = event.data;
    if (playerState === window.YT.PlayerState.PLAYING) {
      _setIsPlaying(true);
    } else if (playerState === window.YT.PlayerState.ENDED) {
      playNext();
    } else { 
      // Covers PAUSED, BUFFERING, CUED
      _setIsPlaying(false);
    }
  }, [_setIsPlaying, _setDuration, playNext, _setIsMuted]);

  // Main progress update interval.
  useEffect(() => {
    const player = playerRef.current;
    if (!isPlaying || !player || typeof player.getCurrentTime !== 'function') {
      return;
    }
    
    const interval = setInterval(() => {
      if (!isSeeking) {
         _setProgress(player.getCurrentTime());
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isPlaying, isSeeking, _setProgress]);
  
  // Main Player Controller Effect.
  // This reacts to "intentions" from the context (isPlaying, isMuted, seekTime).
  useEffect(() => {
    const player = playerRef.current;
    // CRITICAL FIX: Guard Clause to ensure player and song are ready before sending commands.
    if (!player || !currentSong) {
      return;
    }

    // Sync playing state
    const playerState = player.getPlayerState();
    if (isPlaying && playerState !== window.YT.PlayerState.PLAYING) {
      player.playVideo();
    } else if (!isPlaying && playerState === window.YT.PlayerState.PLAYING) {
      player.pauseVideo();
    }

    // Sync mute state
    if (isMuted && !player.isMuted()) {
        player.mute();
    } else if (!isMuted && player.isMuted()) {
        player.unMute();
    }
    
    // Sync seek time
    if (seekTime !== null) {
      player.seekTo(seekTime, true);
      _clearSeek(); 
    }
  }, [isPlaying, currentSong, isMuted, seekTime, _clearSeek]);


  return (
    <YouTube
      key={currentSong.id} // Re-mounts the component when the song changes
      videoId={currentSong.videoId}
      opts={{
        width: '1',
        height: '1',
        playerVars: {
          autoplay: 1, 
          controls: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
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
    const { currentSong, isPlaying, playNext, seekTime, _clearSeek, _setIsPlaying, _setDuration, _setProgress, isSeeking, _setIsMuted, isMuted } = usePlayer();
    const soundcloudPlayerRef = useRef<any>(null);

    // Guard Clause: Render nothing if there is no valid SoundCloud song.
    if (!currentSong || currentSong.type !== 'soundcloud' || !currentSong.url) {
      return null;
    }
    
    // SoundCloud Player Initializer Effect
    useEffect(() => {
        if (!(window as any).SC) return;

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
        
        iframe.src = `https://w.soundcloud.com/player/?url=${currentSong.url}&auto_play=true&visual=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false`;
        
        const widget = (window as any).SC.Widget(iframe);
        soundcloudPlayerRef.current = widget;

        const onReady = () => {
            widget.setVolume(isMuted ? 0 : 1);
            widget.getDuration((d: number) => _setDuration(d / 1000));
            widget.getVolume((v: number) => _setIsMuted(v === 0));
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
            if (soundcloudPlayerRef.current) {
                try {
                     widget.unbind((window as any).SC.Widget.Events.READY);
                     widget.unbind((window as any).SC.widget.events.PLAY);
                     widget.unbind((window as any).SC.widget.events.PAUSE);
                     widget.unbind((window as any).SC.widget.events.FINISH);
                     widget.unbind((window as any).SC.widget.events.PLAY_PROGRESS);
                } catch (e) {
                  // This can fail if the iframe is already removed, which is fine.
                }
            }
            if (iframe) iframe.remove();
            soundcloudPlayerRef.current = null;
        };
    }, [currentSong, _setDuration, playNext, _setIsPlaying, _setProgress, isSeeking, isMuted, _setIsMuted]);
    
    // SoundCloud Controller Effect
    useEffect(() => {
        const widget = soundcloudPlayerRef.current;
        if (!widget) return;
        
        widget.isPaused((paused: boolean) => {
            if (isPlaying && paused) widget.play();
            if (!isPlaying && !paused) widget.pause();
        });

        widget.setVolume(isMuted ? 0 : 1);

        if (seekTime !== null) {
            widget.seekTo(seekTime * 1000);
            _clearSeek();
        }
    }, [isPlaying, isMuted, seekTime, _clearSeek]);


    return null;
};


const UrlPlayerInternal = () => {
    const { currentSong, isPlaying, playNext, seekTime, _clearSeek, _setIsPlaying, _setDuration, _setProgress, isSeeking, _setIsMuted, isMuted } = usePlayer();
    const urlPlayerRef = useRef<HTMLAudioElement | null>(null);

    // Guard Clause: Render nothing if there is no valid URL song.
    if (!currentSong || currentSong.type !== 'url' || !currentSong.url) {
      return null;
    }
    
    // Audio Player Initializer Effect
    useEffect(() => {
        const player = urlPlayerRef.current ?? new Audio();
        if (!urlPlayerRef.current) {
            urlPlayerRef.current = player;
        }

        if (player.src !== currentSong.url) {
            player.src = currentSong.url;
            player.muted = true; // Start muted to allow autoplay
            _setIsMuted(true);
        }
        
        const handleLoadedMetadata = () => _setDuration(player.duration);
        const handleTimeUpdate = () => {
            if (!isSeeking) _setProgress(player.currentTime);
        };
        const handlePlay = () => _setIsPlaying(true);
        const handlePause = () => _setIsPlaying(false);
        const handleEnded = () => playNext();
        const handleVolumeChange = () => _setIsMuted(player.muted || player.volume === 0);

        player.addEventListener('loadedmetadata', handleLoadedMetadata);
        player.addEventListener('timeupdate', handleTimeUpdate);
        player.addEventListener('play', handlePlay);
        player.addEventListener('pause', handlePause);
        player.addEventListener('ended', handleEnded);
        player.addEventListener('volumechange', handleVolumeChange);

        return () => {
            player.removeEventListener('loadedmetadata', handleLoadedMetadata);
            player.removeEventListener('timeupdate', handleTimeUpdate);
            player.removeEventListener('play', handlePlay);
            player.removeEventListener('pause', handlePause);
            player.removeEventListener('ended', handleEnded);
            player.removeEventListener('volumechange', handleVolumeChange);
        };
    }, [currentSong, _setDuration, _setProgress, _setIsPlaying, playNext, isSeeking, _setIsMuted]);

    // Audio Player Controller Effect
     useEffect(() => {
        const player = urlPlayerRef.current;
        if (!player) return;

        if (isPlaying) {
            player.play().catch(e => console.error("Audio playback failed:", e));
        } else {
            player.pause();
        }
        
        player.muted = isMuted;

        if (seekTime !== null && player.readyState > 0) {
            player.currentTime = seekTime;
            _clearSeek();
        }
    }, [isPlaying, isMuted, seekTime, _clearSeek, currentSong]);

    return null;
};


/**
 * The main Player component. It acts as a router, rendering the correct
 * internal player engine based on the current song's type.
 */
export function Player() {
  const { currentSong } = usePlayer();
  
  if (!currentSong) {
    return null;
  }

  switch (currentSong.type) {
    case 'youtube':
      return <YouTubePlayerInternal />;
    case 'soundcloud':
      return <SoundCloudPlayerInternal />;
    case 'url':
      return <UrlPlayerInternal />;
    default:
      return null;
  }
}

    