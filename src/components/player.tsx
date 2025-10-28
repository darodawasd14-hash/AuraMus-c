'use client';

import React, { useEffect } from 'react';
import YouTube from 'react-youtube';
import { usePlayer, type Song } from '@/context/player-context';
import { AuraLogo } from './icons';

type PlayerProps = {
  song: Song | null;
};

const SoundCloudPlayer = ({ song, onEnded }: { song: Song; onEnded: () => void; }) => {
  const { soundcloudPlayerRef, isPlaying } = usePlayer();

  useEffect(() => {
    if (!soundcloudPlayerRef.current) return;

    const widget = (window as any).SC.Widget(soundcloudPlayerRef.current);
    
    const onReady = () => {
      widget.bind((window as any).SC.Widget.Events.FINISH, onEnded);
      if (isPlaying) {
        widget.play();
      } else {
        widget.pause();
      }
    };

    widget.bind((window as any).SC.Widget.Events.READY, onReady);
    
    // This effect should re-run if isPlaying changes for the same song
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
  }, [song.id, isPlaying]);
  
  return (
    <iframe
      ref={soundcloudPlayerRef}
      key={song.id}
      width="100%"
      height="100%"
      scrolling="no"
      frameBorder="no"
      allow="autoplay"
      src={`https://w.soundcloud.com/player/?url=${song.url}&auto_play=false&visual=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&color=%234f46e5`}
    ></iframe>
  );
};


const UrlPlayer = ({ song, onEnded }: { song: Song; onEnded: () => void; }) => {
    const { urlPlayerRef, isPlaying } = usePlayer();

    useEffect(() => {
        if (!urlPlayerRef.current) return;
        if (isPlaying) {
            urlPlayerRef.current.play().catch(e => console.error("URL audio playback error:", e));
        } else {
            urlPlayerRef.current.pause();
        }
    }, [isPlaying, song.id, urlPlayerRef]);

    return <audio ref={urlPlayerRef} src={song.url} onEnded={onEnded} className="w-0 h-0"/>;
}

export function Player({ song }: PlayerProps) {
  const { playNext, youtubePlayerRef, isPlaying } = usePlayer();

  // Assigns the player object to the ref once it's ready.
  const onReady = (event: any) => {
    youtubePlayerRef.current = event.target;
  };
  
  // Controls playback based on the global isPlaying state.
  useEffect(() => {
      if (!youtubePlayerRef.current) return;
      if (isPlaying) {
          youtubePlayerRef.current.playVideo();
      } else {
          youtubePlayerRef.current.pauseVideo();
      }
  }, [isPlaying, song, youtubePlayerRef]);

  // Clean up the ref when the component unmounts or song changes
  useEffect(() => {
    return () => {
      if(youtubePlayerRef.current) {
        // Stop video and nullify ref to prevent memory leaks on song change
        youtubePlayerRef.current.stopVideo();
        youtubePlayerRef.current = null;
      }
    };
  }, [song?.id, youtubePlayerRef]);


  const onEnd = () => {
    playNext();
  };

  if (!song) {
    // Return null or a placeholder, but don't render any players
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
                autoplay: 1, // Autoplay is now controlled by the useEffect above
                controls: 0, // Controls hidden for our custom UI
                modestbranding: 1,
                rel: 0,
              },
            }}
            onReady={onReady}
            onEnd={onEnd}
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

  // This wrapper will be hidden (w-0 h-0) in AuraApp, so it won't be visible.
  // Its only purpose is to keep the player SDKs alive in the DOM.
  return (
    <div id="persistent-player-wrapper">
      {renderPlayer()}
    </div>
  );
}
