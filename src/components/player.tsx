'use client';

import React, { useEffect, useRef } from 'react';
import YouTube from 'react-youtube';
import { usePlayer, type Song } from '@/context/player-context';

type PlayerProps = {
  song: Song | null;
};

export function Player({ song }: PlayerProps) {
  const { isPlaying, playNext, setPlayerReady } = usePlayer();
  const playerRef = useRef<any>(null);

  useEffect(() => {
    // This effect handles play/pause commands from the context
    if (playerRef.current && song) {
      if (isPlaying) {
        if (song.type === 'youtube' && playerRef.current.playVideo) {
          playerRef.current.playVideo();
        }
      } else {
        if (song.type === 'youtube' && playerRef.current.pauseVideo) {
          playerRef.current.pauseVideo();
        }
      }
    }
  }, [isPlaying, song]);

  const onReady = (event: any) => {
    playerRef.current = event.target;
    setPlayerReady(true);
    if (isPlaying) {
      event.target.playVideo();
    }
  };

  const onEnd = () => {
    playNext();
  };

  if (!song) {
    return (
      <div id="player-wrapper" className="aspect-video bg-black rounded-lg shadow-lg flex items-center justify-center">
        <div id="player-placeholder" className="text-gray-500">Select a song to play...</div>
      </div>
    );
  }

  return (
    <div id="player-wrapper" className="aspect-video bg-black rounded-lg shadow-lg">
      {song.type === 'youtube' && song.videoId ? (
        <YouTube
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
        <iframe
            width="100%"
            height="100%"
            scrolling="no"
            frameBorder="no"
            allow="autoplay"
            src={`https://w.soundcloud.com/player/?url=${song.url}&auto_play=${isPlaying}&visual=true`}
        ></iframe>
      ) : (
        <div className="aspect-video bg-black rounded-lg shadow-lg flex items-center justify-center">
          <div className="text-gray-500">Unsupported song type.</div>
        </div>
      )}
    </div>
  );
}
