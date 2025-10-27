'use client';

import React, { useEffect, useRef } from 'react';
import YouTube from 'react-youtube';
import { usePlayer, type Song } from '@/context/player-context';
import { AuraLogo } from './icons';

type PlayerProps = {
  song: Song | null;
};

const SoundCloudPlayer = ({ song, isPlaying, volume }: { song: Song; isPlaying: boolean; volume: number; }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    if (iframeRef.current) {
      const widget = (window as any).SC.Widget(iframeRef.current);
      widgetRef.current = widget;
      widget.bind((window as any).SC.Widget.Events.READY, () => {
        if (widgetRef.current && typeof widgetRef.current.setVolume === 'function') {
          widgetRef.current.setVolume(volume);
          if (isPlaying) {
            widgetRef.current.play();
          } else {
            widgetRef.current.pause();
          }
        }
      });
      widget.bind((window as any).SC.Widget.Events.FINISH, () => {
        // In a real app, you'd call playNext() here through the context.
      });
    }
  }, [song.id]);

  useEffect(() => {
    if (widgetRef.current && typeof widgetRef.current.setVolume === 'function') {
        widgetRef.current.setVolume(volume);
    }
  }, [volume]);

  useEffect(() => {
    if (widgetRef.current && typeof widgetRef.current.play === 'function' && typeof widgetRef.current.pause === 'function') {
      if (isPlaying) {
        widgetRef.current.play();
      } else {
        widgetRef.current.pause();
      }
    }
  }, [isPlaying, song.id]);

  return (
    <iframe
      ref={iframeRef}
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

export function Player({ song }: PlayerProps) {
  const { isPlaying, playNext, setYoutubePlayer, volume } = usePlayer();

  const onReady = (event: any) => {
    setYoutubePlayer(event.target);
    // Ensure setVolume is available before calling it, and only call it when ready.
    if (event.target && typeof event.target.setVolume === 'function') {
        event.target.setVolume(volume);
    }
  };

  const onEnd = () => {
    playNext();
  };

  if (!song) {
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
              autoplay: isPlaying ? 1 : 0,
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
        <SoundCloudPlayer song={song} isPlaying={isPlaying} volume={volume} />
      ) : (
        <div className="aspect-video bg-secondary/50 rounded-lg shadow-lg flex items-center justify-center border border-border">
          <div className="text-muted-foreground">Unsupported song type.</div>
        </div>
      )}
    </div>
  );
}
