'use client';

import React, { useEffect, useRef } from 'react';
import YouTube from 'react-youtube';
import { usePlayer, type Song } from '@/context/player-context';

const SoundCloudPlayer = ({ song }: { song: Song; }) => {
  const { isPlaying, setProgress, setDuration, isSeeking, playNext, setIsPlaying, soundcloudPlayerRef } = usePlayer();
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    if (!song.url || !(window as any).SC) return;

    const widgetIframe = soundcloudPlayerRef.current;
    if (!widgetIframe) return;

    const widget = (window as any).SC.Widget(widgetIframe);
    widgetRef.current = widget;

    const onReady = () => {
      widget.getDuration((d: number) => setDuration(d / 1000));
      widget.bind((window as any).SC.Widget.Events.FINISH, playNext);
      if (isPlaying) {
        widget.play();
      }
    };
    
    widget.bind((window as any).SC.Widget.Events.READY, onReady);
    widget.bind((window as any).SC.Widget.Events.PLAY, () => setIsPlaying(true));
    widget.bind((window as any).SC.Widget.Events.PAUSE, () => setIsPlaying(false));
    widget.bind((window as any).SC.Widget.Events.PLAY_PROGRESS, (data: { currentPosition: number }) => {
        if (!isSeeking) setProgress(data.currentPosition / 1000);
    });

    return () => {
      try {
        if (widgetRef.current) {
          widgetRef.current.unbind((window as any).SC.Widget.Events.READY);
          widgetRef.current.unbind((window as any).SC.Widget.Events.PLAY);
          widgetRef.current.unbind((window as any).SC.Widget.Events.PAUSE);
          widgetRef.current.unbind((window as any).SC.Widget.Events.FINISH);
          widgetRef.current.unbind((window as any).SC.Widget.Events.PLAY_PROGRESS);
        }
      } catch (e) { /* Suppress errors */ }
    };
  }, [song.url, playNext, setDuration, setProgress, isSeeking, soundcloudPlayerRef, setIsPlaying, isPlaying]);

  useEffect(() => {
    if (widgetRef.current) {
      if (isPlaying) {
        widgetRef.current.play();
      } else {
        widgetRef.current.pause();
      }
    }
  }, [isPlaying]);

  return (
    <iframe
      ref={soundcloudPlayerRef}
      key={song.id}
      id="soundcloud-player"
      width="0"
      height="0"
      scrolling="no"
      frameBorder="no"
      allow="autoplay"
      src={`https://w.soundcloud.com/player/?url=${song.url}&auto_play=true&visual=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false`}
    ></iframe>
  );
};


const UrlPlayer = ({ song }: { song: Song }) => {
    const { urlPlayerRef, isPlaying, setProgress, setDuration, isSeeking, playNext, setIsPlaying } = usePlayer();

    useEffect(() => {
        const player = urlPlayerRef.current;
        if (!player) return;

        const handleTimeUpdate = () => !isSeeking && setProgress(player.currentTime);
        const handleDurationChange = () => player.duration && isFinite(player.duration) && setDuration(player.duration);
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleEnded = () => playNext();

        // Assign src only if it's different to avoid re-loading
        if (player.src !== song.url) {
            player.src = song.url;
            player.load(); // Load the new source
        }

        player.addEventListener('timeupdate', handleTimeUpdate);
        player.addEventListener('durationchange', handleDurationChange);
        player.addEventListener('loadedmetadata', handleDurationChange);
        player.addEventListener('play', handlePlay);
        player.addEventListener('pause', handlePause);
        player.addEventListener('ended', handleEnded);

        // Control playback based on isPlaying state
        if (isPlaying) {
            player.play().catch(e => console.error("Audio playback failed:", e));
        } else {
            player.pause();
        }

        return () => {
            player.removeEventListener('timeupdate', handleTimeUpdate);
            player.removeEventListener('durationchange', handleDurationChange);
            player.removeEventListener('loadedmetadata', handleDurationChange);
            player.removeEventListener('play', handlePlay);
            player.removeEventListener('pause', handlePause);
            player.removeEventListener('ended', handleEnded);
        };
    }, [song.url, isPlaying, isSeeking, playNext, setProgress, setDuration, urlPlayerRef, setIsPlaying]);

    return <audio ref={urlPlayerRef} className="w-0 h-0"/>;
};


export function Player({ song }: { song: Song | null }) {
  const { 
    playNext, 
    youtubePlayerRef, 
    setIsPlaying, 
    setProgress, 
    setDuration,
    isSeeking,
    isPlaying
  } = usePlayer();

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const onReady = (event: any) => {
    youtubePlayerRef.current = event.target;
    if (isPlaying) {
        event.target.playVideo();
    }
  };
  
  const onStateChange = (event: any) => {
    const player = event.target;
    
    if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
    }

    if (event.data === 1) { // Playing
      setIsPlaying(true);
      setDuration(player.getDuration());
      progressIntervalRef.current = setInterval(() => {
        if (player && typeof player.getCurrentTime === 'function' && !isSeeking) {
          setProgress(player.getCurrentTime());
        }
      }, 250);

    } else if (event.data === 0) { // Ended
      setIsPlaying(false);
      playNext();
    } else if (event.data === 2) { // Paused
       setIsPlaying(false);
    } else {
       setIsPlaying(false);
    }
  };
  
  // Effect to control YouTube player based on context's isPlaying state
  useEffect(() => {
    const player = youtubePlayerRef.current;
    if (player && typeof player.getPlayerState === 'function' && song?.type === 'youtube') {
      const playerState = player.getPlayerState();
      if (isPlaying && playerState !== 1) {
        player.playVideo();
      } else if (!isPlaying && playerState === 1) {
        player.pauseVideo();
      }
    }
  }, [isPlaying, song]);


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
                autoplay: 1, // Let YouTube try to autoplay
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
