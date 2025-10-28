'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import YouTube from 'react-youtube';
import { usePlayer } from '@/context/player-context';

const YouTubePlayerInternal = () => {
  const {
    currentSong,
    isPlaying,
    playNext,
    _setIsPlaying,
    _setDuration,
    _setProgress,
    seekTime,
    _clearSeek,
  } = usePlayer();
  
  const onReady = useCallback((event: any) => {
    console.log("Oynatıcı hazır. SESSİZ oynatılıyor ve GLOBALE kaydediliyor.");
    event.target.mute();
    event.target.playVideo();
    (window as any).myGlobalPlayer = event.target;
  }, []);

  const onStateChange = useCallback((event: any) => {
    const player = event.target;
    // Sync duration
    if (player && typeof player.getDuration === 'function') {
        const duration = player.getDuration();
        if (duration) _setDuration(duration);
    }
    
    // Playing
    if (event.data === 1) { 
      _setIsPlaying(true);
    // Ended
    } else if (event.data === 0) {
      playNext();
    // Paused or other states
    } else { 
      _setIsPlaying(false);
    }
  }, [_setIsPlaying, _setDuration, playNext]);
  
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    const player = (window as any).myGlobalPlayer;

    if (isPlaying && player && typeof player.getCurrentTime === 'function') {
      progressIntervalRef.current = setInterval(() => {
        const progress = player.getCurrentTime();
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
    const player = (window as any).myGlobalPlayer;
    if (seekTime !== null && player && typeof player.seekTo === 'function') {
      player.seekTo(seekTime, true);
      _clearSeek(); 
    }
  }, [seekTime, _clearSeek]);

  if (!currentSong || currentSong.type !== 'youtube' || !currentSong.videoId) return null;

  return (
    <YouTube
      key={currentSong.id}
      videoId={currentSong.videoId}
      opts={{
        width: '1',
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
        
        iframe.src = `https://w.soundcloud.com/player/?url=${currentSong.url}&auto_play=${isPlaying}&visual=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false`;
        
        const widget = (window as any).SC.Widget(iframe);
        soundcloudPlayerRef.current = widget;

        const onReady = () => {
            widget.getDuration((d: number) => _setDuration(d / 1000));
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
    }, [currentSong, _setDuration, playNext, _setIsPlaying, _setProgress, isSeeking, isPlaying]);
    
    useEffect(() => {
        const widget = soundcloudPlayerRef.current;
        if (!widget) return;
        
        widget.isPaused((paused: boolean) => {
            if (isPlaying && paused) widget.play();
            if (!isPlaying && !paused) widget.pause();
        });

    }, [isPlaying]);

    useEffect(() => {
        if (seekTime !== null && soundcloudPlayerRef.current && typeof soundcloudPlayerRef.current.seekTo === 'function') {
            soundcloudPlayerRef.current.seekTo(seekTime * 1000);
            _clearSeek();
        }
    }, [seekTime, _clearSeek]);

    return null;
};


const UrlPlayerInternal = () => {
    const { currentSong, isPlaying, playNext, seekTime, _clearSeek, _setIsPlaying, _setDuration, _setProgress, isSeeking } = usePlayer();
    const urlPlayerRef = useRef<HTMLAudioElement | null>(null);
    
    useEffect(() => {
        if (currentSong && currentSong.type === 'url' && currentSong.url) {
            
            const player = urlPlayerRef.current ?? new Audio();
            if (!urlPlayerRef.current) urlPlayerRef.current = player;
            
            if (player.src !== currentSong.url) {
                player.src = currentSong.url;
            }

            const handleLoadedMetadata = () => _setDuration(player.duration);
            const handleTimeUpdate = () => {
                if (!isSeeking) _setProgress(player.currentTime);
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
                player.removeEventListener('loadedmetadata', handleLoadedMetadata);
                player.removeEventListener('timeupdate', handleTimeUpdate);
                player.removeEventListener('play', handlePlay);
                player.removeEventListener('pause', handlePause);
                player.removeEventListener('ended', handleEnded);
            };
        }
    }, [currentSong, _setDuration, _setProgress, _setIsPlaying, playNext, isSeeking]);

     useEffect(() => {
        const player = urlPlayerRef.current;
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
      return null;
  }
}
