'use client';

import React, { useEffect, useRef } from 'react';
import YouTube from 'react-youtube';
import { usePlayer, type Song } from '@/context/player-context';
import { AuraLogo } from './icons';

type PlayerProps = {
  song: Song | null;
};

const SoundCloudPlayer = ({ song, isPlaying, volume, onEnded }: { song: Song; isPlaying: boolean; volume: number; onEnded: () => void; }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetRef = useRef<any>(null);
  const isReadyRef = useRef(false);

  // Effect to handle song changes and widget creation
  useEffect(() => {
    // Only run when the song ID changes
    if (!iframeRef.current) return;

    const widget = (window as any).SC.Widget(iframeRef.current);
    widgetRef.current = widget;
    isReadyRef.current = false; // Reset ready state for new widget

    const onReady = () => {
      isReadyRef.current = true;
      const currentWidget = widgetRef.current;
      if (currentWidget) {
        currentWidget.setVolume(volume / 100);
        // Autoplay is handled by the URL, so no need to call play() here
        
        // Setup finish event listener
        currentWidget.unbind((window as any).SC.Widget.Events.FINISH);
        currentWidget.bind((window as any).SC.Widget.Events.FINISH, () => {
          onEnded();
        });
      }
    };

    widget.bind((window as any).SC.Widget.Events.READY, onReady);
    
    // Cleanup function for when the component unmounts or song changes
    return () => {
      const currentWidget = widgetRef.current;
      if (currentWidget && typeof currentWidget.unbind === 'function') {
        try {
          // Unbind events to prevent memory leaks and errors on unmount
          currentWidget.unbind((window as any).SC.Widget.Events.READY);
          currentWidget.unbind((window as any).SC.Widget.Events.FINISH);
        } catch (e) {
          // Suppress error: If the iframe is already gone, unbinding will fail.
          // This is a safe error to ignore during component cleanup.
        }
      }
    };
  }, [song.id, onEnded, volume]); // Depend on song.id to re-create widget, and others for closure.

  // Effect to handle volume changes
  useEffect(() => {
    if (widgetRef.current && isReadyRef.current) {
      widgetRef.current.setVolume(volume / 100);
    }
  }, [volume]);
  
  // The key prop ensures the iframe is re-created when the song ID changes.
  // auto_play=true handles starting the music, removing the need for a complex isPlaying effect.
  // When the component is unmounted (e.g., song changes or paused from context), the iframe is destroyed, stopping the music.
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
  const { isPlaying, playNext, setYoutubePlayer, volume } = usePlayer();

  const onReady = (event: any) => {
    setYoutubePlayer(event.target);
    // Set volume immediately when player is ready
    event.target.setVolume(volume);
  };

  const onEnd = () => {
    playNext();
  };

  if (!song || !isPlaying) { // Also check for isPlaying
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
              autoplay: 1, // Always autoplay when the component is rendered
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
        <SoundCloudPlayer song={song} isPlaying={isPlaying} volume={volume} onEnded={onEnd} />
      ) : (
        <div className="aspect-video bg-secondary/50 rounded-lg shadow-lg flex items-center justify-center border border-border">
          <div className="text-muted-foreground">Unsupported song type.</div>
        </div>
      )}
    </div>
  );
}
