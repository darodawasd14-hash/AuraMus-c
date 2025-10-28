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

  const onReady = useCallback((event: any) => {
    playerRef.current = event.target;
    // Autoplay muted to comply with browser policies
    playerRef.current.mute();
    _setIsMuted(true);
    // The playVideo command is now managed by the isPlaying useEffect
  }, [_setIsMuted]);

  const onStateChange = useCallback((event: any) => {
    const player = playerRef.current;
    if (!player) return;

    // Sync duration
    const duration = player.getDuration();
    if (duration) _setDuration(duration);

    // Sync Mute State
    _setIsMuted(player.isMuted());
    
    const playerState = event.data;
    // Playing
    if (playerState === 1) { 
      _setIsPlaying(true);
    // Ended
    } else if (playerState === 0) {
      playNext();
    // Paused or other states
    } else { 
      _setIsPlaying(false);
    }
  }, [_setIsPlaying, _setDuration, playNext, _setIsMuted]);

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // This effect handles the progress bar updates
  useEffect(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    const player = playerRef.current;

    if (isPlaying && player && typeof player.getCurrentTime === 'function') {
      progressIntervalRef.current = setInterval(() => {
        if (!isSeeking) {
           const progress = player.getCurrentTime();
           _setProgress(progress);
        }
      }, 250);
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, isSeeking, _setProgress]);
  
  // This is the MASTER CONTROLLER effect for the YouTube player.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !currentSong) return;

    // Sync Play/Pause state
    const playerState = player.getPlayerState();
    if (isPlaying && playerState !== 1) {
      player.playVideo();
    } else if (!isPlaying && playerState === 1) {
      player.pauseVideo();
    }
  }, [isPlaying, currentSong]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
     // Sync Mute state
    if (isMuted && !player.isMuted()) {
        player.mute();
    } else if (!isMuted && player.isMuted()) {
        player.unMute();
    }
  }, [isMuted]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    // Sync Seek Time
    if (seekTime !== null) {
      player.seekTo(seekTime, true);
      _clearSeek(); 
    }
  }, [seekTime, _clearSeek]);


  if (!currentSong || currentSong.type !== 'youtube' || !currentSong.videoId) return null;

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
                     widget.unbind((window as any).SC.Widget.Events.PLAY);
                     widget.unbind((window as any).SC.Widget.Events.PAUSE);
                     widget.unbind((window as any).SC.Widget.Events.FINISH);
                     widget.unbind((window as any).SC.Widget.Events.PLAY_PROGRESS);
                } catch (e) {}
            }
            if (iframe) iframe.remove();
            soundcloudPlayerRef.current = null;
        };
    }, [currentSong, _setDuration, playNext, _setIsPlaying, _setProgress, isSeeking, isMuted, _setIsMuted]);
    
    // Master controller for SoundCloud
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
    
    useEffect(() => {
        const player = urlPlayerRef.current ?? new Audio();
        if (!urlPlayerRef.current) {
            urlPlayerRef.current = player;
        }

        if (currentSong && currentSong.type === 'url' && player.src !== currentSong.url) {
            player.src = currentSong.url;
            player.muted = isMuted; // Set initial mute state
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
    }, [currentSong, _setDuration, _setProgress, _setIsPlaying, playNext, isSeeking, _setIsMuted, isMuted]);

     useEffect(() => {
        const player = urlPlayerRef.current;
        if (!player) return;

        if (isPlaying) {
            player.play().catch(e => console.error("Audio playback failed:", e));
        } else {
            player.pause();
        }
        
        player.muted = isMuted;

        if (seekTime !== null) {
            player.currentTime = seekTime;
            _clearSeek();
        }
    }, [isPlaying, isMuted, seekTime, _clearSeek]);

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
      return null;
  }
}

    