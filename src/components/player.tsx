'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import YouTube from 'react-youtube';
import { usePlayer } from '@/context/player-context';

// This is the "Motor" component.
// Its only job is to listen to the "Brain" (PlayerContext) and control the players.
// It also reports back the player's real status to the "Brain".

const YouTubePlayerInternal = () => {
  const { currentSong, isPlaying, playNext, seekTime, _clearSeek, _setIsPlaying, _setDuration, _setProgress } = usePlayer();
  const playerRef = useRef<any>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const onReady = useCallback((event: any) => {
    // This is the magic moment. The player is ready.
    // We store the "remote control" for later.
    playerRef.current = event.target;
    // Now we get the duration and tell the context about it.
    _setDuration(playerRef.current.getDuration());
    // If the context's intention is to play, we play.
    if (isPlaying) {
      playerRef.current.playVideo();
    }
  }, [isPlaying, _setDuration]);

  const onStateChange = useCallback((event: any) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    // The player's state changed, so we report back to the context.
    if (event.data === 1) { // Playing
      _setIsPlaying(true);
      _setDuration(playerRef.current.getDuration()); // Update duration in case it was not available before
      // Start a timer to report progress
      progressIntervalRef.current = setInterval(() => {
        if (playerRef.current) {
          _setProgress(playerRef.current.getCurrentTime());
        }
      }, 250);
    } else if (event.data === 0) { // Ended
      _setIsPlaying(false);
      playNext();
    } else { // Paused, buffering, etc.
      _setIsPlaying(false);
    }
  }, [_setIsPlaying, _setDuration, _setProgress, playNext]);
  
  // This effect synchronizes the context's "intent" (isPlaying) with the player's actual state.
  useEffect(() => {
    const player = playerRef.current;
    // We only send commands if the player is ready.
    if (player && typeof player.getPlayerState === 'function') {
      const playerState = player.getPlayerState();
      if (isPlaying && playerState !== 1) {
        player.playVideo();
      } else if (!isPlaying && playerState === 1) {
        player.pauseVideo();
      }
    }
  }, [isPlaying, currentSong]); // Re-run when the song or play state changes.

  // This effect handles seeking.
  useEffect(() => {
    if (seekTime !== null && playerRef.current) {
      playerRef.current.seekTo(seekTime, true);
      _clearSeek(); // Tell the context the seek command has been executed.
    }
  }, [seekTime, _clearSeek]);
  
  // Cleanup the progress timer on unmount.
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  if (!currentSong || currentSong.type !== 'youtube' || !currentSong.videoId) return null;

  // We use the key prop to force a re-render of the YouTube component when the song changes.
  // This is crucial for loading a new video.
  return (
    <YouTube
      key={currentSong.id}
      videoId={currentSong.videoId}
      opts={{
        width: '0',
        height: '0',
        playerVars: {
          autoplay: 1, // Let's try to autoplay, but onReady is the real gatekeeper.
          controls: 0,
          modestbranding: 1,
          rel: 0,
        },
      }}
      onReady={onReady}
      onStateChange={onStateChange}
      className="hidden" // More semantic than w-0 h-0
    />
  );
};

const SoundCloudPlayerInternal = () => {
    const { currentSong, isPlaying, _setIsPlaying, _setDuration, _setProgress, playNext, seekTime, _clearSeek, isSeeking } = usePlayer();
    const widgetRef = useRef<any>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    useEffect(() => {
        if (!currentSong || currentSong.type !== 'soundcloud' || !(window as any).SC) return;

        const iframeId = `soundcloud-player-${currentSong.id}`;
        let iframe = document.getElementById(iframeId) as HTMLIFrameElement;
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = iframeId;
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
        }
        iframeRef.current = iframe;
        
        iframe.src = `https://w.soundcloud.com/player/?url=${currentSong.url}&auto_play=false&visual=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false`;
        
        const widget = (window as any).SC.Widget(iframe);
        widgetRef.current = widget;

        const onReady = () => {
            widget.getDuration((d: number) => _setDuration(d / 1000));
            if (isPlaying) {
                widget.play();
            }
        };

        widget.bind((window as any).SC.Widget.Events.READY, onReady);
        widget.bind((window as any).SC.Widget.Events.FINISH, playNext);
        widget.bind((window as any).SC.Widget.Events.PLAY, () => _setIsPlaying(true));
        widget.bind((window as any).SC.Widget.Events.PAUSE, () => _setIsPlaying(false));
        widget.bind((window as any).SC.Widget.Events.PLAY_PROGRESS, (data: { currentPosition: number }) => {
            if (!isSeeking) _setProgress(data.currentPosition / 1000);
        });

        return () => {
            if (widgetRef.current) {
                try {
                     widgetRef.current.unbind((window as any).SC.Widget.Events.READY);
                } catch (e) {}
            }
            if (iframeRef.current) {
                iframeRef.current.remove();
            }
        };
    }, [currentSong, _setDuration, playNext, _setIsPlaying, _setProgress, isSeeking, isPlaying]);


    useEffect(() => {
        const widget = widgetRef.current;
        if (widget) {
            widget.isPaused((paused: boolean) => {
                if (isPlaying && paused) {
                    widget.play();
                } else if (!isPlaying && !paused) {
                    widget.pause();
                }
            });
        }
    }, [isPlaying]);

    useEffect(() => {
        if (seekTime !== null && widgetRef.current) {
            widgetRef.current.seekTo(seekTime * 1000);
            _clearSeek();
        }
    }, [seekTime, _clearSeek]);

    return null;
};


const UrlPlayerInternal = () => {
    const { currentSong, isPlaying, _setIsPlaying, _setDuration, _setProgress, playNext, seekTime, _clearSeek, isSeeking } = usePlayer();
    
    useEffect(() => {
        if (!currentSong || currentSong.type !== 'url') return;
        
        let player: HTMLAudioElement | null = new Audio(currentSong.url);

        const handleDurationChange = () => {
            if (player && player.duration && isFinite(player.duration)) {
                _setDuration(player.duration);
            }
        };
        const handleTimeUpdate = () => {
            if (player && !isSeeking) _setProgress(player.currentTime);
        };
        const handlePlay = () => _setIsPlaying(true);
        const handlePause = () => _setIsPlaying(false);
        const handleEnded = () => playNext();

        player.addEventListener('loadedmetadata', handleDurationChange);
        player.addEventListener('durationchange', handleDurationChange);
        player.addEventListener('timeupdate', handleTimeUpdate);
        player.addEventListener('play', handlePlay);
        player.addEventListener('pause', handlePause);
        player.addEventListener('ended', handleEnded);

        if (seekTime !== null) {
            player.currentTime = seekTime;
            _clearSeek();
        }

        if (isPlaying) {
            player.play().catch(e => console.error("Audio playback failed:", e));
        } else {
            player.pause();
        }

        return () => {
            if(player) {
                player.removeEventListener('loadedmetadata', handleDurationChange);
                player.removeEventListener('durationchange', handleDurationChange);
                player.removeEventListener('timeupdate', handleTimeUpdate);
                player.removeEventListener('play', handlePlay);
                player.removeEventListener('pause', handlePause);
                player.removeEventListener('ended', handleEnded);
                player.pause();
                player.src = '';
                player = null;
            }
        };
    }, [currentSong, isPlaying, seekTime, _setIsPlaying, _setDuration, _setProgress, _clearSeek, playNext, isSeeking]);

    return null;
};


export function Player() {
  const { currentSong } = usePlayer();
  if (!currentSong) return null;

  const renderPlayer = () => {
    switch (currentSong.type) {
      case 'youtube':
        return <YouTubePlayerInternal />;
      case 'soundcloud':
        return <SoundCloudPlayerInternal />;
      case 'url':
        return <UrlPlayerInternal />;
      default:
        console.warn(`Unknown song type: ${currentSong.type}`);
        return null;
    }
  };

  return (
    // This div is hidden but ensures the players are always in the DOM when needed.
    <div id="persistent-player-wrapper" className="hidden">
      {renderPlayer()}
    </div>
  );
}
