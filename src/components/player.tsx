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
  const { setSoundcloudPlayer, isPlaying } = usePlayer();

  useEffect(() => {
    if (!iframeRef.current) return;

    const widget = (window as any).SC.Widget(iframeRef.current);
    setSoundcloudPlayer(widget);

    const onReady = () => {
      widget.bind((window as any).SC.Widget.Events.FINISH, onEnded);
      if(isPlaying) {
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
      setSoundcloudPlayer(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id]);
  
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


const UrlPlayer = ({ song, onEnded }: { song: Song; onEnded: () => void; }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const { setUrlPlayer, isPlaying } = usePlayer();

    useEffect(() => {
        if(audioRef.current){
            setUrlPlayer(audioRef.current)
        }
        return () => {
            setUrlPlayer(null)
        }
    },[song.id, setUrlPlayer])
    
    useEffect(() => {
        if(!audioRef.current) return;
        if(isPlaying){
            audioRef.current.play().catch(e => console.error("URL audio playback error:", e));
        } else {
            audioRef.current.pause()
        }
    }, [isPlaying, song.id])

    return <audio ref={audioRef} src={song.url} onEnded={onEnded} controls className="w-full"/>
}

export function Player({ song }: PlayerProps) {
  const { playNext, setYoutubePlayer } = usePlayer();

  useEffect(() => {
    return () => {
      setYoutubePlayer(null);
    };
  }, [song?.id, setYoutubePlayer]);

  const onReady = (event: any) => {
    setYoutubePlayer(event.target);
  };

  const onEnd = () => {
    playNext();
  };

  if (!song) {
    return (
      <div id="player-placeholder" className="text-muted-foreground flex flex-col items-center gap-4">
        <AuraLogo className="w-20 h-20" />
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
                controls: 1, // Show controls for volume, etc.
                modestbranding: 1,
                rel: 0,
              },
            }}
            onReady={onReady}
            onEnd={onEnd}
            className="w-full h-full"
          />
        ) : <div className="text-destructive-foreground p-4">Geçersiz YouTube ID</div>;
      case 'soundcloud':
        return <SoundCloudPlayer song={song} onEnded={onEnd} />;
      case 'url':
        return <UrlPlayer song={song} onEnded={onEnd} />;
      default:
        return (
          <div className="p-4">Desteklenmeyen şarkı türü.</div>
        );
    }
  }

  return (
    <div id="player-wrapper">
      {renderPlayer()}
    </div>
  );
}
