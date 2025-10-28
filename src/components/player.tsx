'use client';

import React, { useEffect } from 'react';
import YouTube from 'react-youtube';
import { usePlayer, type Song } from '@/context/player-context';

type PlayerProps = {
  song: Song | null;
};

const SoundCloudPlayer = ({ song, onEnded }: { song: Song; onEnded: () => void; }) => {
  const { soundcloudPlayerRef, isPlaying, setIsPlaying } = usePlayer();

  useEffect(() => {
    if (!soundcloudPlayerRef.current) return;

    const widget = (window as any).SC.Widget(soundcloudPlayerRef.current);
    
    const onReady = () => {
      widget.bind((window as any).SC.Widget.Events.FINISH, onEnded);
      // Autoplay when ready
      widget.play();
      setIsPlaying(true);
    };

    widget.bind((window as any).SC.Widget.Events.READY, onReady);

    // Control via isPlaying state change
    if (isPlaying) {
      widget.play();
    } else {
      widget.pause();
    }
    
    return () => {
      try {
        widget.unbind((window as any).SC.Widget.Events.FINISH);
        widget.unbind((window as any).SC.Widget.Events.READY);
      } catch (e) {
        // Hata bastırma
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id]); // Only re-run when song changes
  
  useEffect(() => {
     if (!soundcloudPlayerRef.current) return;
     const widget = (window as any).SC.Widget(soundcloudPlayerRef.current);
     if (isPlaying) {
        widget.play();
     } else {
        widget.pause();
     }
  }, [isPlaying]);

  return (
    <iframe
      ref={soundcloudPlayerRef}
      key={song.id}
      width="100%"
      height="100%"
      scrolling="no"
      frameBorder="no"
      allow="autoplay"
      src={`https://w.soundcloud.com/player/?url=${song.url}&auto_play=true&visual=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&color=%234f46e5`}
    ></iframe>
  );
};


const UrlPlayer = ({ song, onEnded }: { song: Song; onEnded: () => void; }) => {
    const { urlPlayerRef, isPlaying, setIsPlaying } = usePlayer();

    useEffect(() => {
        if (!urlPlayerRef.current) return;

        const player = urlPlayerRef.current;
        const handleCanPlay = () => {
            if (player) {
                player.play().catch(e => console.error("URL audio playback error:", e));
                setIsPlaying(true);
            }
        };
        player.addEventListener('canplay', handleCanPlay);
        player.load();

        return () => {
            player.removeEventListener('canplay', handleCanPlay);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [song.id, urlPlayerRef]);

    useEffect(() => {
        if (!urlPlayerRef.current) return;
        if (isPlaying) {
            urlPlayerRef.current.play().catch(e => console.error("URL audio playback error:", e));
        } else {
            urlPlayerRef.current.pause();
        }
    }, [isPlaying, urlPlayerRef]);


    return <audio ref={urlPlayerRef} src={song.url} onEnded={onEnded} className="w-0 h-0"/>;
}

export function Player({ song }: PlayerProps) {
  const { playNext, youtubePlayerRef, setIsPlaying } = usePlayer();

  const onReady = (event: any) => {
    youtubePlayerRef.current = event.target;
    // The video will autoplay due to playerVars.
    // We sync the state to reflect this.
    setIsPlaying(true); 
  };
  
  const onStateChange = (event: any) => {
    // event.data can be:
    // -1 (unstarted)
    // 0 (ended) -> playNext()
    // 1 (playing) -> setIsPlaying(true)
    // 2 (paused) -> setIsPlaying(false)
    // 3 (buffering)
    // 5 (video cued)
    if (event.data === 0) {
      playNext();
    } else if (event.data === 1) {
      setIsPlaying(true);
    } else if (event.data === 2) {
      setIsPlaying(false);
    }
  };

  const onEnd = () => {
    playNext();
  };

  // Clean up the ref when the component unmounts or song changes
  useEffect(() => {
    return () => {
      if(youtubePlayerRef.current) {
        youtubePlayerRef.current.destroy();
        youtubePlayerRef.current = null;
      }
    };
  }, [song?.id, youtubePlayerRef]);


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
              width: '100%',
              height: '100%',
              playerVars: {
                autoplay: 1, // Let YouTube handle autoplay
                controls: 0,
                modestbranding: 1,
                rel: 0,
              },
            }}
            onReady={onReady}
            onStateChange={onStateChange} // Use the more detailed state change handler
            className="w-full h-full"
          />
        ) : <div className="w-full h-full flex items-center justify-center bg-black text-destructive-foreground p-4">Geçersiz YouTube ID</div>;
      case 'soundcloud':
        return <SoundCloudPlayer song={song} onEnded={onEnd} />;
      case 'url':
        return <UrlPlayer song={song} onEnded={onEnd} />;
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
