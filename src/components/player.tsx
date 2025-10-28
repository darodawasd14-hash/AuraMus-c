'use client';

import React, { useEffect, useRef } from 'react';
import YouTube from 'react-youtube';
import { usePlayer, type Song } from '@/context/player-context';

const SoundCloudPlayer = ({ song }: { song: Song }) => {
  const { isPlaying, setProgress, setDuration, isSeeking, playNext, setIsPlaying, seekTo } = usePlayer();
  const widgetRef = useRef<any>(null);

  // Effect for creating and managing the widget
  useEffect(() => {
    if (!song.url || !(window as any).SC) return;

    // Use a local iframe, don't rely on a shared ref
    const iframeId = `soundcloud-player-${song.id}`;
    let iframe = document.getElementById(iframeId) as HTMLIFrameElement;
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = iframeId;
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
    }
    iframe.src = `https://w.soundcloud.com/player/?url=${song.url}&auto_play=true&visual=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false`;

    const widget = (window as any).SC.Widget(iframe);
    widgetRef.current = widget;

    const onReady = () => {
      widget.getDuration((d: number) => setDuration(d / 1000));
      widget.bind((window as any).SC.Widget.Events.FINISH, playNext);
      widget.bind((window as any).SC.Widget.Events.PLAY, () => setIsPlaying(true));
      widget.bind((window as any).SC.Widget.Events.PAUSE, () => setIsPlaying(false));
      widget.bind((window as any).SC.Widget.Events.PLAY_PROGRESS, (data: { currentPosition: number }) => {
        if (!isSeeking) setProgress(data.currentPosition / 1000);
      });
      // Initial play is handled by auto_play=true
    };
    
    widget.bind((window as any).SC.Widget.Events.READY, onReady);

    return () => {
      try {
        if (widgetRef.current) {
          widgetRef.current.unbind((window as any).SC.Widget.Events.READY);
          widgetRef.current.unbind((window as any).SC.Widget.Events.PLAY);
          widgetRef.current.unbind((window as any).SC.Widget.Events.PAUSE);
          widgetRef.current.unbind((window as any).SC.Widget.Events.FINISH);
          widgetRef.current.unbind((window as any).SC.Widget.Events.PLAY_PROGRESS);
        }
        iframe.remove();
      } catch (e) { /* Suppress errors */ }
    };
  }, [song.id, song.url, playNext, setDuration, setProgress, isSeeking, setIsPlaying]);

  // Effect for controlling playback (play/pause)
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

  return null; // The iframe is managed directly in the DOM
};


const UrlPlayer = ({ song }: { song: Song }) => {
  const { isPlaying, setProgress, setDuration, isSeeking, playNext, setIsPlaying } = usePlayer();

  useEffect(() => {
    let player = new Audio(song.url);

    const handleTimeUpdate = () => {
      if (!isSeeking) setProgress(player.currentTime);
    };
    const handleDurationChange = () => {
      if (player.duration && isFinite(player.duration)) {
        setDuration(player.duration);
      }
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => playNext();

    player.addEventListener('loadedmetadata', handleDurationChange);
    player.addEventListener('timeupdate', handleTimeUpdate);
    player.addEventListener('play', handlePlay);
    player.addEventListener('pause', handlePause);
    player.addEventListener('ended', handleEnded);

    if (isPlaying) {
      player.play().catch(e => console.error("Audio playback failed:", e));
    } else {
      player.pause();
    }

    return () => {
      player.removeEventListener('loadedmetadata', handleDurationChange);
      player.removeEventListener('timeupdate', handleTimeUpdate);
      player.removeEventListener('play', handlePlay);
      player.removeEventListener('pause', handlePause);
      player.removeEventListener('ended', handleEnded);
      player.pause();
      player.src = '';
    };
  }, [song.url, isPlaying, isSeeking, playNext, setDuration, setIsPlaying, setProgress]);

  return null;
};


export function Player({ song }: { song: Song | null }) {
  const {
    isPlaying,
    playNext,
    setIsPlaying,
    setProgress,
    setDuration,
    isSeeking,
    seekTo,
  } = usePlayer();
  const youtubePlayerRef = useRef<any>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // This effect handles PLAY/PAUSE commands from the context
  useEffect(() => {
    const player = youtubePlayerRef.current;
    if (player && typeof player.getPlayerState === 'function') {
      const playerState = player.getPlayerState();
      // 1 = playing, 2 = paused
      if (isPlaying && playerState !== 1) {
        player.playVideo();
      } else if (!isPlaying && playerState === 1) {
        player.pauseVideo();
      }
    }
  }, [isPlaying]);

  // This effect handles SEEK commands from the context
  useEffect(() => {
    const handleSeek = (time: number) => {
        if (youtubePlayerRef.current && typeof youtubePlayerRef.current.seekTo === 'function') {
            youtubePlayerRef.current.seekTo(time, true);
        }
    };
    seekTo(handleSeek);
  }, [seekTo]);


  const onReady = (event: any) => {
    youtubePlayerRef.current = event.target;
    // When the player is ready, if the context wants it to play, play it.
    if (isPlaying) {
      event.target.playVideo();
    }
  };

  const onStateChange = (event: any) => {
    const player = event.target;
    
    // Clear any existing interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    // Player states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
    if (event.data === 1) { // Playing
      setIsPlaying(true);
      setDuration(player.getDuration());
      // Start polling for progress
      progressIntervalRef.current = setInterval(() => {
        if (player && typeof player.getCurrentTime === 'function' && !isSeeking) {
          setProgress(player.getCurrentTime());
        }
      }, 250);
    } else if (event.data === 0) { // Ended
      setIsPlaying(false);
      playNext();
    } else { // Paused, Buffering, etc.
      setIsPlaying(false);
    }
  };
  
  useEffect(() => {
    // Cleanup interval on unmount
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  if (!song) {
    return null;
  }

  const renderPlayer = () => {
    switch (song.type) {
      case 'youtube':
        return song.videoId ? (
          <YouTube
            key={song.id}
            videoId={song.videoId}
            opts={{
              width: '0',
              height: '0',
              playerVars: {
                autoplay: 1, // Autoplay to reduce race conditions
                controls: 0,
                modestbranding: 1,
                rel: 0,
              },
            }}
            onReady={onReady}
            onStateChange={onStateChange}
            className="w-0 h-0"
          />
        ) : <div className="w-full h-full flex items-center justify-center bg-black text-destructive-foreground p-4">Geçersiz YouTube ID</div>;
      case 'soundcloud':
        return <SoundCloudPlayer song={song} />;
      case 'url':
        return <UrlPlayer song={song} />;
      default:
        return null;
    }
  }

  return (
    <div id="persistent-player-wrapper">
      {renderPlayer()}
    </div>
  );
}
