'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import YouTube from 'react-youtube';
import { usePlayer, type Song } from '@/context/player-context';


// ### YOUTUBE PLAYER ###
const YouTubePlayerInternal = () => {
  const { currentSong, isPlaying, _setIsPlaying, playNext, seekTime, _seekTo, _setDuration, _setProgress, _setIsSeeking, isSeeking } = usePlayer();
  const playerRef = useRef<any>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Oynatıcıyı hazır olduğunda referansa ata
  const onReady = (event: any) => {
    playerRef.current = event.target;
    // Oynatıcı hazır olduğunda ve çalması gerekiyorsa çal
    if (isPlaying) {
      playerRef.current.playVideo();
    }
  };

  // Oynatıcı durumu değiştiğinde context'i güncelle
  const onStateChange = useCallback((event: any) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    // Oynatıcı durumları: -1 (başlamadı), 0 (bitti), 1 (çalıyor), 2 (duraklatıldı), 3 (arabelleğe alınıyor), 5 (video sıraya alındı)
    if (event.data === 1) { // Çalıyor
      _setIsPlaying(true);
      _setDuration(playerRef.current.getDuration());
      // İlerlemeyi takip etmek için interval başlat
      progressIntervalRef.current = setInterval(() => {
        if (playerRef.current && !isSeeking) {
          _setProgress(playerRef.current.getCurrentTime());
        }
      }, 250);
    } else if (event.data === 0) { // Bitti
      _setIsPlaying(false);
      playNext();
    } else { // Duraklatıldı, arabelleğe alınıyor, vb.
      _setIsPlaying(false);
    }
  }, [_setIsPlaying, _setDuration, _setProgress, playNext, isSeeking]);

  // Context'teki `isPlaying` durumu değiştiğinde oynatıcıyı kontrol et
  useEffect(() => {
    const player = playerRef.current;
    if (player && typeof player.getPlayerState === 'function') {
      const playerState = player.getPlayerState();
      if (isPlaying && playerState !== 1) {
        player.playVideo();
      } else if (!isPlaying && playerState === 1) {
        player.pauseVideo();
      }
    }
  }, [isPlaying, currentSong]); // currentSong değiştiğinde de kontrol et

  // Context'ten seek komutu geldiğinde çalış
  useEffect(() => {
    if (seekTime !== null && playerRef.current) {
      playerRef.current.seekTo(seekTime, true);
      _setIsSeeking(false); // Arayüzün kaydırıcıyı serbest bırakması için
    }
  }, [seekTime, _setIsSeeking]);

  // Component unmount olduğunda interval'i temizle
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);
  
  if (!currentSong || currentSong.type !== 'youtube' || !currentSong.videoId) return null;

  return (
    <YouTube
      key={currentSong.id}
      videoId={currentSong.videoId}
      opts={{
        width: '0',
        height: '0',
        playerVars: {
          autoplay: 1, // Otomatik başlatma yarış durumlarını önler
          controls: 0,
          modestbranding: 1,
          rel: 0,
        },
      }}
      onReady={onReady}
      onStateChange={onStateChange}
      className="w-0 h-0"
    />
  );
}


// ### SOUNDCLOUD PLAYER ###
const SoundCloudPlayerInternal = () => {
    const { currentSong, isPlaying, _setIsPlaying, _setDuration, _setProgress, _setIsSeeking, playNext, seekTime, isSeeking } = usePlayer();
    const widgetRef = useRef<any>(null);

    // SoundCloud widget'ını oluşturma ve yönetme
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
        iframe.src = `https://w.soundcloud.com/player/?url=${currentSong.url}&auto_play=true&visual=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false`;

        const widget = (window as any).SC.Widget(iframe);
        widgetRef.current = widget;

        const onReady = () => {
            widget.getDuration((d: number) => _setDuration(d / 1000));
            widget.bind((window as any).SC.Widget.Events.FINISH, playNext);
            widget.bind((window as any).SC.Widget.Events.PLAY, () => _setIsPlaying(true));
            widget.bind((window as any).SC.Widget.Events.PAUSE, () => _setIsPlaying(false));
            widget.bind((window as any).SC.Widget.Events.PLAY_PROGRESS, (data: { currentPosition: number }) => {
                if (!isSeeking) _setProgress(data.currentPosition / 1000);
            });
            if (isPlaying) {
              widget.play();
            }
        };

        widget.bind((window as any).SC.Widget.Events.READY, onReady);

        return () => {
            if (widgetRef.current) {
                widgetRef.current.unbind((window as any).SC.Widget.Events.READY);
                // Diğer unbind'ları da ekleyebilirsiniz.
            }
            iframe.remove();
        };
    }, [currentSong, _setDuration, playNext, _setIsPlaying, _setProgress, isSeeking]);

    // Oynatma durumunu kontrol etme
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

    // Seek işlemini yönetme
    useEffect(() => {
        if (seekTime !== null && widgetRef.current) {
            widgetRef.current.seekTo(seekTime * 1000);
             _setIsSeeking(false);
        }
    }, [seekTime, _setIsSeeking]);

    return null;
};


// ### URL (MP3) PLAYER ###
const UrlPlayerInternal = () => {
    const { currentSong, isPlaying, _setIsPlaying, _setDuration, _setProgress, _setIsSeeking, playNext, seekTime, isSeeking } = usePlayer();

    useEffect(() => {
        if (!currentSong || currentSong.type !== 'url') return;
        
        const player = new Audio(currentSong.url);

        const handleTimeUpdate = () => {
            if (!isSeeking) _setProgress(player.currentTime);
        };
        const handleDurationChange = () => {
            if (player.duration && isFinite(player.duration)) {
                _setDuration(player.duration);
            }
        };
        const handlePlay = () => _setIsPlaying(true);
        const handlePause = () => _setIsPlaying(false);
        const handleEnded = () => playNext();

        player.addEventListener('loadedmetadata', handleDurationChange);
        player.addEventListener('timeupdate', handleTimeUpdate);
        player.addEventListener('play', handlePlay);
        player.addEventListener('pause', handlePause);
        player.addEventListener('ended', handleEnded);

        if (isPlaying) {
            player.play().catch(e => console.error("Audio playback failed:", e));
        } else {
            player.pause();
        }

        if (seekTime !== null) {
            player.currentTime = seekTime;
            _setIsSeeking(false);
        }

        return () => {
            player.removeEventListener('loadedmetadata', handleDurationChange);
            player.removeEventListener('timeupdate', handleTimeUpdate);
            player.removeEventListener('play', handlePlay);
            player.removeEventListener('pause', handlePause);
            player.removeEventListener('ended', handleEnded);
            player.pause();
            player.src = '';
        };
    }, [currentSong, isPlaying, seekTime, _setIsPlaying, _setDuration, _setProgress, _setIsSeeking, playNext, isSeeking]);

    return null;
};


// ### ANA PLAYER BILEŞENİ ###
export function Player({ song }: { song: Song | null }) {
  if (!song) return null;

  const renderPlayer = () => {
    switch (song.type) {
      case 'youtube':
        return <YouTubePlayerInternal />;
      case 'soundcloud':
        return <SoundCloudPlayerInternal />;
      case 'url':
        return <UrlPlayerInternal />;
      default:
        return null;
    }
  };

  return (
    <div id="persistent-player-wrapper">
      {renderPlayer()}
    </div>
  );
}
