'use client';
import React, { useContext, useState, useEffect, useRef } from 'react';
import YouTube, { YouTubePlayer } from 'react-youtube';
import { usePlayer } from '@/context/player-context';

// Player state'ini (oynatıcı nesnesini) saklamak için bir referans
// Not: Bunu state (useState) yerine ref (useRef) ile yapmak,
// gereksiz yeniden render'ların önüne geçer. Bu daha performanslıdır.
let playerRef: YouTubePlayer | null = null;

export const Player = () => {
  const { 
    currentSong, 
    isPlaying, 
    playNext, 
    _setIsPlaying, 
    _setProgress, 
    _setDuration,
    isSeeking,
    isMuted,
    volume,
    seekTime,
    _clearSeek
  } = usePlayer();

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startProgressTracking = (player: YouTubePlayer) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    progressIntervalRef.current = setInterval(() => {
      if (player && typeof player.getCurrentTime === 'function' && !isSeeking) {
        _setProgress(player.getCurrentTime());
        _setDuration(player.getDuration());
      }
    }, 500);
  };
  
  const stopProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  // 1. YouTube oynatıcısı hazır olduğunda çalışan fonksiyon
  const handleOnReady = (event: { target: YouTubePlayer }) => {
    // Oynatıcıyı ("uzaktan kumandayı") referansımıza kaydediyoruz.
    playerRef = event.target;
    startProgressTracking(playerRef);

    // Başlangıçta sessize al
    playerRef.mute();

    // Eğer bu fonksiyon çalıştığında zaten çalıyor olmamız gerekiyorsa
    // (örneğin şarkıya tıkladık, player YENİ yüklendi), çal komutunu ver.
    if (isPlaying) {
      playerRef?.playVideo();
    }
  };
  
  const handleOnStateChange = (event: { data: number }) => {
    const playerState = event.data;
    if (playerState === YouTube.PlayerState.PLAYING) {
      _setIsPlaying(true);
      startProgressTracking(event.target);
    } else if (playerState === YouTube.PlayerState.PAUSED) {
      _setIsPlaying(false);
      stopProgressTracking();
    } else if (playerState === YouTube.PlayerState.ENDED) {
      playNext();
    }
  }

  // 2. 'isPlaying' (Beyin'den gelen) durumu değiştiğinde çalışan ana kontrol
  useEffect(() => {
    // Eğer "kumanda" (playerRef) henüz elimizde değilse, hiçbir şey yapma.
    if (!playerRef) {
      return;
    }

    // Kumanda elimizdeyse:
    // 'isPlaying' durumu 'true' ise çal, 'false' ise durdur.
    if (isPlaying) {
      playerRef.playVideo();
      // Kullanıcı oynat tuşuna bastığında sesi aç
      if (playerRef.isMuted()) {
        playerRef.unMute();
      }
    } else {
      // pauseVideo fonksiyonunun varlığını kontrol etmek her zaman iyidir.
      if (playerRef && typeof playerRef.pauseVideo === 'function') {
        playerRef.pauseVideo();
      }
    }
  }, [isPlaying]); // Bu effect SADECE 'isPlaying' durumuna bağlı olmalı.

  // 3. 'currentSong' (çalınacak şarkı) değiştiğinde çalışan effect
  useEffect(() => {
    // Eğer şarkı değiştiyse VE "kumanda" elimizdeyse,
    // yeni şarkıyı yükle ve (eğer 'isPlaying' true ise) otomatik oynat.
    if (currentSong && playerRef && currentSong.videoId) {
      playerRef.loadVideoById(currentSong.videoId); // Yeni şarkıyı yükle
      if (isPlaying) {
        playerRef.playVideo(); // Çalıyorsa devam et
      }
    }
     // Cleanup on unmount
     return () => {
      stopProgressTracking();
    };
  }, [currentSong]); // Bu effect SADECE 'currentSong' değişimine bağlı.

  useEffect(() => {
    if (!playerRef) return;
    if (playerRef.isMuted() !== isMuted) {
      isMuted ? playerRef.mute() : playerRef.unMute();
    }
  }, [isMuted]);
  
  useEffect(() => {
      if (!playerRef) return;
      playerRef.setVolume(volume * 100);
  }, [volume]);
  
  useEffect(() => {
    if (seekTime !== null && playerRef) {
      playerRef.seekTo(seekTime, true);
      _clearSeek(); // Reset seek time in context
    }
  }, [seekTime, playerRef, _clearSeek]);


  // Oynatılacak bir şarkı yoksa veya şarkı youtube değilse bileşeni hiç gösterme.
  if (!currentSong || currentSong.type !== 'youtube' || !currentSong.videoId) {
    return null;
  }

  // YouTube oynatıcı seçenekleri
  const opts = {
    height: '0',
    width: '0',
    playerVars: {
      autoplay: 0, // Otomatik oynatmayı biz yöneteceğiz, o yüzden '0'.
      controls: 0,
      playsinline: 1
    },
  };

  return (
      <YouTube
        videoId={currentSong.videoId} // Burası önemli: 'currentSong' nesneniz 'videoId' içermeli
        opts={opts}
        onReady={handleOnReady}
        onStateChange={handleOnStateChange}
        onEnd={playNext}
        // Hata durumunda konsola bilgi yazdır
        onError={(e) => console.error('YouTube Player Error:', e)}
        className="absolute top-[-9999px] left-[-9999px] w-0 h-0"
      />
  );
};
