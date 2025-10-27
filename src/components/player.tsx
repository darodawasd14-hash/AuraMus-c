'use client';

import React, { useEffect, useRef } from 'react';
import YouTube from 'react-youtube';
import { usePlayer, type Song } from '@/context/player-context';
import { AuraLogo } from './icons';

type PlayerProps = {
  song: Song | null;
};

const SoundCloudPlayer = ({ song, onEnded }: { song: Song; onEnded: () => void; }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { setSoundcloudPlayer } = usePlayer();

  useEffect(() => {
    if (!iframeRef.current) return;

    const widget = (window as any).SC.Widget(iframeRef.current);
    setSoundcloudPlayer(widget);

    const onReady = () => {
      widget.bind((window as any).SC.Widget.Events.FINISH, onEnded);
      widget.play();
    };

    widget.bind((window as any).SC.Widget.Events.READY, onReady);
    
    return () => {
      setSoundcloudPlayer(null);
      try {
        widget.unbind((window as any).SC.Widget.Events.FINISH);
        widget.unbind((window as any).SC.Widget.Events.READY);
      } catch (e) {
        // Hata bastırma
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id, onEnded, setSoundcloudPlayer]);
  
  return (
    <iframe
      ref={iframeRef}
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


const UrlPlayerPlaceholder = () => {
    // This is a placeholder and doesn't render anything visible.
    // The actual audio playback is handled by the global <audio> tag in PlayerProvider.
    return null;
}

export function Player({ song }: PlayerProps) {
  const { playNext, setYoutubePlayer } = usePlayer();

  const onReady = (event: any) => {
    setYoutubePlayer(event.target);
  };

  const onEnd = () => {
    playNext();
  };

  if (!song) {
    return (
      <div id="player-wrapper" className="aspect-video bg-secondary/50 rounded-lg shadow-lg flex items-center justify-center border border-border">
        <div id="player-placeholder" className="text-muted-foreground flex flex-col items-center gap-4">
          <AuraLogo className="w-20 h-20 animate-pulse" />
          <p>Başlamak için bir şarkı seçin</p>
        </div>
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
        ) : null;
      case 'soundcloud':
        return <SoundCloudPlayer song={song} onEnded={onEnd} />;
      case 'url':
        return <UrlPlayerPlaceholder />;
      default:
        return (
          <div className="aspect-video bg-secondary/50 rounded-lg shadow-lg flex items-center justify-center border border-border">
            <div className="text-muted-foreground">Desteklenmeyen şarkı türü.</div>
          </div>
        );
    }
  }

  return (
    <div id="player-wrapper" className="aspect-video bg-black rounded-lg shadow-lg overflow-hidden">
      {renderPlayer()}
    </div>
  );
}
