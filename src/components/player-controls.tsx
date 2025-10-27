'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { usePlayer } from '@/context/player-context';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

export function PlayerControls() {
  const { currentSong, isPlaying, togglePlayPause, playNext, playPrev } = usePlayer();
  const [progress, setProgress] = useState(0);
  const animationFrameId = useRef<number>();

  useEffect(() => {
    if (isPlaying && currentSong) {
      const startTime = Date.now();
      const animate = () => {
        const elapsedTime = Date.now() - startTime;
        const newProgress = (elapsedTime / (currentSong.durationSeconds * 1000)) * 100;
        if (newProgress < 100) {
          setProgress(newProgress);
          animationFrameId.current = requestAnimationFrame(animate);
        } else {
          setProgress(100);
          playNext();
        }
      };
      animationFrameId.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    }

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isPlaying, currentSong, playNext]);
  
  useEffect(() => {
    setProgress(0);
  }, [currentSong]);

  if (!currentSong) {
    return null;
  }

  const formatTime = (seconds: number) => {
    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  const currentTime = (progress / 100) * currentSong.durationSeconds;


  return (
    <div className="fixed bottom-0 left-0 right-0 h-28 lg:h-24 bg-card/80 backdrop-blur-xl border-t z-50">
      <div className="container mx-auto h-full px-4">
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center gap-4 w-1/4">
            <Image
              src={currentSong.coverArt}
              alt={currentSong.album}
              width={56}
              height={56}
              className="rounded-md object-cover"
              data-ai-hint={currentSong.coverArtHint}
            />
            <div>
              <p className="font-semibold text-sm truncate">{currentSong.title}</p>
              <p className="text-xs text-muted-foreground truncate">{currentSong.artist}</p>
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-2 w-1/2 max-w-xl">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={playPrev}>
                <SkipBack className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-12 w-12" onClick={togglePlayPause}>
                {isPlaying ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={playNext}>
                <SkipForward className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex items-center gap-2 w-full">
                <span className="text-xs text-muted-foreground w-10 text-right">{formatTime(currentTime)}</span>
                <Slider
                    value={[progress]}
                    max={100}
                    step={0.1}
                    className="w-full"
                    onValueChange={(value) => {
                      // In a real app, you would seek the song here
                    }}
                />
                <span className="text-xs text-muted-foreground w-10">{currentSong.duration}</span>
            </div>
          </div>

          <div className="w-1/4">
            {/* Volume controls could go here */}
          </div>
        </div>
      </div>
    </div>
  );
}
