'use client';

import React, { useEffect, useRef } from 'react';
import YouTube from 'react-youtube';
import { usePlayer, type Song } from '@/context/player-context';

const SoundCloudPlayer = ({ song, onEnded }: { song: Song; onEnded: () => void; }) => {
  const { soundcloudPlayerRef, isPlaying, setProgress, setDuration, isSeeking } = usePlayer();
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    if (!soundcloudPlayerRef.current) return;
    const widget = (window as any).SC.Widget(soundcloudPlayerRef.current);
    widgetRef.current = widget;
    
    const onReady = () => {
      widget.bind((window as any).SC.Widget.Events.FINISH, onEnded);
      widget.getDuration((d: number) => setDuration(d / 1000));
      if (isPlaying) {
        widget.play();
      }
    };
    widget.bind((window as any).SC.Widget.Events.READY, onReady);

    const onPlayProgress = (data: { currentPosition: number }) => {
        if (!isSeeking) {
            setProgress(data.currentPosition / 1000);
        }
    };
    widget.bind((window as any).SC.Widget.Events.PLAY_PROGRESS, onPlayProgress);

    return () => {
      try {
        widget.unbind((window as any).SC.Widget.Events.FINISH);
        widget.unbind((window as any).SC.Widget.Events.READY);
        widget.unbind((window as any).SC.Widget.Events.PLAY_PROGRESS);
      } catch (e) {
        // Hata bastırma
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id]);
  
  useEffect(() => {
     if (!widgetRef.current) return;
     if (isPlaying) {
        widgetRef.current.play();
     } else {
        widgetRef.current.pause();
     }
  }, [isPlaying]);

  return (
    <iframe
      ref={soundcloudPlayerRef}
      key={song.id}
      id="soundcloud-player"
      width="100%"
      height="100"
      scrolling="no"
      frameBorder="no"
      allow="autoplay"
      src={`https://w.soundcloud.com/player/?url=${song.url}&auto_play=false&visual=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&color=%234f46e5`}
    ></iframe>
  );
};


const UrlPlayer = ({ song, onEnded }: { song: Song; onEnded: () => void; }) => {
    const { urlPlayerRef, isPlaying, setProgress, setDuration, isSeeking } = usePlayer();

    useEffect(() => {
        const player = urlPlayerRef.current;
        if (!player) return;

        const handleTimeUpdate = () => {
            if (!isSeeking) {
                setProgress(player.currentTime);
            }
        };
        const handleDurationChange = () => {
            setDuration(player.duration);
        };

        player.addEventListener('timeupdate', handleTimeUpdate);
        player.addEventListener('durationchange', handleDurationChange);
        player.addEventListener('canplay', handleDurationChange); // For browsers that need it
        player.addEventListener('loadedmetadata', handleDurationChange);

        return () => {
            player.removeEventListener('timeupdate', handleTimeUpdate);
            player.removeEventListener('durationchange', handleDurationChange);
            player.removeEventListener('canplay', handleDurationChange);
            player.removeEventListener('loadedmetadata', handleDurationChange);
        }
    }, [urlPlayerRef, setProgress, setDuration, isSeeking]);


    useEffect(() => {
        if (!urlPlayerRef.current) return;
        if (isPlaying) {
            urlPlayerRef.current.play().catch(e => console.error("URL audio playback error:", e));
        } else {
            urlPlayerRef.current.pause();
        }
    }, [isPlaying, urlPlayerRef, song.id]);


    return <audio ref={urlPlayerRef} src={song.url} onEnded={onEnded} className="w-0 h-0"/>;
}

export function Player({ song }: { song: Song | null }) {
  const { 
    playNext, 
    youtubePlayerRef, 
    isPlaying,
    setIsPlaying, 
    setProgress, 
    setDuration,
    isSeeking
  } = usePlayer();

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const cleanupProgressInterval = () => {
      if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
      }
  };

  // Main logic to control the player based on context state
  useEffect(() => {
    const player = youtubePlayerRef.current;
    if (!player || !song || song.type !== 'youtube') {
      return;
    }

    if (isPlaying) {
        player.playVideo();
    } else {
        player.pauseVideo();
    }
  }, [isPlaying, song, youtubePlayerRef]);

  const onReady = (event: any) => {
    youtubePlayerRef.current = event.target;
    if (isPlaying) {
      event.target.playVideo();
    }
  };
  
  const onStateChange = (event: any) => {
    const player = youtubePlayerRef.current;
    cleanupProgressInterval();

    // -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
    if (event.data === 1) { // Playing
      if(!isPlaying) setIsPlaying(true);
      setDuration(player.getDuration());
      progressIntervalRef.current = setInterval(() => {
        if (player && typeof player.getCurrentTime === 'function' && !isSeeking) {
          const currentTime = player.getCurrentTime();
          setProgress(currentTime);
        }
      }, 500);

    } else if (event.data === 0) { // Ended
      playNext();
    } else { // Paused, Buffering, etc.
      if(isPlaying) setIsPlaying(false);
    }
  };

  useEffect(() => {
    // Cleanup interval on component unmount
    return () => {
      cleanupProgressInterval();
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
                autoplay: 0, // We control play/pause manually
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
        return <SoundCloudPlayer song={song} onEnded={playNext} />;
      case 'url':
        return <UrlPlayer song={song} onEnded={playNext} />;
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
