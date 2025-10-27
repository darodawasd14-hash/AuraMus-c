'use client';

import React, { useEffect, useRef } from 'react';
import YouTube from 'react-youtube';
import { usePlayer, type Song } from '@/context/player-context';
import { AuraLogo } from './icons';

type PlayerProps = {
  song: Song | null;
};

const SoundCloudPlayer = ({ song, isMuted, onEnded }: { song: Song; isMuted: boolean; onEnded: () => void; }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetRef = useRef<any>(null);
  const isReadyRef = useRef(false);
  const volume = isMuted ? 0 : 80;

  useEffect(() => {
    if (!iframeRef.current) return;

    const widget = (window as any).SC.Widget(iframeRef.current);
    widgetRef.current = widget;
    isReadyRef.current = false;

    const onReady = () => {
      isReadyRef.current = true;
      const currentWidget = widgetRef.current;
      if (currentWidget) {
        currentWidget.setVolume(volume / 100);
        
        currentWidget.unbind((window as any).SC.Widget.Events.FINISH);
        currentWidget.bind((window as any).SC.Widget.Events.FINISH, () => {
          onEnded();
        });
      }
    };

    widget.bind((window as any).SC.Widget.Events.READY, onReady);
    
    return () => {
      const currentWidget = widgetRef.current;
      if (currentWidget && typeof currentWidget.unbind === 'function') {
        try {
          currentWidget.unbind((window as any).SC.Widget.Events.READY);
          currentWidget.unbind((window as any).SC.Widget.Events.FINISH);
        } catch (e) {
           // Suppress error: If the iframe is already gone, unbinding will fail.
        }
      }
    };
  }, [song.id, onEnded, volume]);

  useEffect(() => {
    if (widgetRef.current && isReadyRef.current) {
      widgetRef.current.setVolume(volume / 100);
    }
  }, [volume]);
  
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

export function Player({ song }: PlayerProps) {
  const { isPlaying, playNext, setYoutubePlayer, isMuted } = usePlayer();
  const volume = isMuted ? 0 : 80;

  const onReady = (event: any) => {
    setYoutubePlayer(event.target);
    event.target.setVolume(volume);
  };

  const onEnd = () => {
    playNext();
  };

  if (!song || !isPlaying) {
    return (
      <div id="player-wrapper" className="aspect-video bg-secondary/50 rounded-lg shadow-lg flex items-center justify-center border border-border">
        <div id="player-placeholder" className="text-muted-foreground flex flex-col items-center gap-4">
          <AuraLogo className="w-20 h-20 animate-pulse" />
          <p>Select a song to begin</p>
        </div>
      </div>
    );
  }

  return (
    <div id="player-wrapper" className="aspect-video bg-black rounded-lg shadow-lg overflow-hidden">
      {song.type === 'youtube' && song.videoId ? (
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
      ) : song.type === 'soundcloud' ? (
        <SoundCloudPlayer song={song} isMuted={isMuted} onEnded={onEnd} />
      ) : (
        <div className="aspect-video bg-secondary/50 rounded-lg shadow-lg flex items-center justify-center border border-border">
          <div className="text-muted-foreground">Unsupported song type.</div>
        </div>
      )}
    </div>
  );
}
