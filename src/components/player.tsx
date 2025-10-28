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
      }
    };

    widget.bind((window as any).SC.Widget.Events.READY, onReady);
    
    return () => {
      try {
        widget.unbind((window as any).SC.Widget.Events.FINISH);
        widget.unbind((window as any).SC.Widget.Events.READY);
      } catch (e) {
        // Hata bastırma
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id]);
  
  return (
    <iframe
      ref={soundcloudPlayerRef}
      key={song.id}
      width="100%"
      height="100%"
      scrolling="no"
      frameBorder="no"
      allow="autoplay"
      src={`https://w.soundcloud.com/player/?url=${song.url}&auto_play=${isPlaying}&visual=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&color=%234f46e5`}
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

    return <audio ref={urlPlayerRef} src={song.url} onEnded={onEnded} controls className="w-full"/>;
}

export function Player({ song }: PlayerProps) {
  const { playNext, youtubePlayerRef } = usePlayer();

  const onReady = (event: any) => {
    youtubePlayerRef.current = event.target;
    event.target.playVideo();
  };
  
  // Clean up the ref when the component unmounts or song changes
  useEffect(() => {
    return () => {
      youtubePlayerRef.current = null;
    };
  }, [song?.id, youtubePlayerRef]);


  const onEnd = () => {
    playNext();
  };

  if (!song) {
    return (
      <div id="player-placeholder" className="w-full h-full text-muted-foreground bg-secondary/50 rounded-lg shadow-lg flex items-center justify-center border border-border">
        <AuraLogo className="w-2/5 h-2/5" />
      </div>
    );
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
                autoplay: 1,
                controls: 1,
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
        return (
          <div className="w-full h-full flex items-center justify-center p-4">Desteklenmeyen şarkı türü.</div>
        );
    }
  }

  return (
    <div id="player-wrapper" className="w-full h-full aspect-video bg-black rounded-lg shadow-lg overflow-hidden">
      {renderPlayer()}
    </div>
  );
}
