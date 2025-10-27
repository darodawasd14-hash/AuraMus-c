'use client';

import React, { useEffect, useRef } from 'react';
import YouTube from 'react-youtube';
import { usePlayer, type Song } from '@/context/player-context';
import { AuraLogo } from './icons';

type PlayerProps = {
  song: Song | null;
};

export function Player({ song }: PlayerProps) {
  const { isPlaying, playNext, setYoutubePlayer, volume } = usePlayer();
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (playerRef.current && song) {
      const player = playerRef.current;
      const playerState = player.getPlayerState ? player.getPlayerState() : -1;
      
      if (isPlaying && playerState !== 1) { // 1 = playing
        if (song.type === 'youtube' && player.playVideo) {
          player.playVideo();
        }
      } else if (!isPlaying && playerState === 1) {
        if (song.type === 'youtube' && player.pauseVideo) {
          player.pauseVideo();
        }
      }
    }
  }, [isPlaying, song]);
  
  useEffect(() => {
    if (playerRef.current && song && song.type === 'youtube' && playerRef.current.setVolume) {
      playerRef.current.setVolume(volume);
    }
  }, [volume, song]);


  const onReady = (event: any) => {
    playerRef.current = event.target;
    setYoutubePlayer(event.target);
    event.target.setVolume(volume);
    if (isPlaying) {
      event.target.playVideo();
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
        <iframe
            key={song.id}
            width="100%"
            height="100%"
            scrolling="no"
            frameBorder="no"
            allow="autoplay"
            src={`https://w.soundcloud.com/player/?url=${song.url}&auto_play=${isPlaying}&visual=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&color=%234f46e5`}
        ></iframe>
      ) : (
        <div className="aspect-video bg-secondary/50 rounded-lg shadow-lg flex items-center justify-center border border-border">
          <div className="text-muted-foreground">Unsupported song type.</div>
        </div>
      )}
    </div>
  );
}
