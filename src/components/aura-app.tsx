'use client';
import React, { useContext } from 'react';
import ReactPlayer from 'react-player';
import { PlayerContext } from '@/context/player-context';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { PlayIcon, PauseIcon, SkipBack, SkipForward, Music, Volume2, VolumeX } from '@/components/icons';
import Image from 'next/image';

// A helper to format seconds into MM:SS
const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds === Infinity) return '0:00';
    const date = new Date(seconds * 1000);
    const mm = date.getUTCMinutes();
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    return `${mm}:${ss}`;
};

// The main view for the player
const AuraPlayerView = () => {
  const { 
    currentSong, 
    isPlaying, 
    hasInteracted,
    activateSound,
    isReady,
  } = useContext(PlayerContext)!;

  return (
    <div className="flex-grow flex flex-col items-center justify-center p-4 md:p-6 bg-background">
        <div className="w-full max-w-4xl aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center relative shadow-2xl">
            {currentSong ? (
              <>
                {/* This is the VISIBLE player, it acts as a "vitrine" */}
                {/* It's always muted from its own props; sound comes from the invisible player */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  <ReactPlayer
                      key={`visible-${currentSong.id}`}
                      url={currentSong.url}
                      playing={isPlaying}
                      volume={0}
                      muted={true}
                      controls={false}
                      width="100%"
                      height="100%"
                      config={{
                          youtube: { playerVars: { showinfo: 0, modestbranding: 1, rel: 0 } }
                      }}
                  />
                </div>
                
                {/* This is the invisible "sound activation" layer */}
                {!hasInteracted && isReady && (
                     <div 
                        className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center transition-opacity cursor-pointer z-10 hover:bg-black/60"
                        onClick={activateSound}
                    >
                       <div className="bg-black/50 rounded-full p-4 hover:bg-black/70 transition-all">
                         <PlayIcon className="w-12 h-12 text-white" />
                       </div>
                       <p className="text-white mt-4 font-semibold">Oynatmak için tıklayın</p>
                    </div>
                )}
              </>
            ) : (
                <div className="text-muted-foreground flex flex-col items-center gap-2">
                    <Music className="w-12 h-12"/>
                    <p>Oynatıcı Alanı</p>
                    <p className="text-xs">Çalınacak bir şarkı seçin.</p>
                </div>
            )}
        </div>
    </div>
  );
};


// The control bar at the bottom
const PlayerBar = () => {
    const { 
        currentSong, 
        isPlaying, 
        progress, 
        duration, 
        volume, 
        isMuted, 
        togglePlayPause, 
        playNext, 
        playPrevious, 
        seek, 
        setVolume, 
        toggleMute, 
        isReady 
    } = useContext(PlayerContext)!;


    const handleProgressChange = (value: number[]) => {
      if (currentSong) {
        seek(value[0]);
      }
    };
    
    return (
        <div className="h-24 bg-secondary/80 border-t border-border backdrop-blur-xl p-4 flex items-center gap-4 text-foreground">
            <div className="flex items-center gap-3 w-64">
                {currentSong?.artwork ? (
                     <Image src={currentSong.artwork} alt={currentSong.title} width={56} height={56} className="rounded-md" />
                ) : (
                    <div className="w-14 h-14 bg-muted rounded-md flex items-center justify-center">
                        <Music className="w-8 h-8 text-muted-foreground"/>
                    </div>
                )}
                <div>
                    <p className="font-semibold text-sm truncate">{currentSong?.title || 'Şarkı Seçilmedi'}</p>
                    <p className="text-xs text-muted-foreground">{currentSong?.type || 'Kaynak Yok'}</p>
                </div>
            </div>

            <div className="flex-grow flex flex-col items-center gap-2">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={playPrevious} disabled={!currentSong || !isReady}>
                        <SkipBack className="w-5 h-5"/>
                    </Button>
                    <Button
                        variant="default"
                        size="icon"
                        className="w-12 h-12 rounded-full"
                        onClick={togglePlayPause}
                        disabled={!currentSong || !isReady}
                    >
                        {isPlaying ? <PauseIcon className="w-5 h-5"/> : <PlayIcon className="w-5 h-5"/>}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={playNext} disabled={!currentSong || !isReady}>
                        <SkipForward className="w-5 h-5"/>
                    </Button>
                </div>
                <div className="w-full flex items-center gap-2">
                    <span className="text-xs w-12 text-right">{formatTime(progress * duration)}</span>
                    <Slider
                        value={[progress]}
                        max={1}
                        step={0.01}
                        onValueChange={handleProgressChange}
                        className="flex-grow"
                        disabled={!currentSong || !isReady}
                    />
                    <span className="text-xs w-12">{formatTime(duration)}</span>
                </div>
            </div>

            <div className="flex items-center gap-2 w-64 justify-end">
                <Button variant="ghost" size="icon" onClick={toggleMute} disabled={!isReady}>
                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5"/> : <Volume2 className="w-5 h-5"/>}
                </Button>
                 <Slider
                    value={[isMuted ? 0 : volume]}
                    max={1}
                    step={0.05}
                    onValueChange={(value) => setVolume(value[0])}
                    className="w-24"
                    disabled={!isReady}
                />
            </div>
        </div>
    );
};


// The main app component that wraps everything
export function AuraApp() {
  return (
    <div id="app-container" className="relative h-screen w-screen flex flex-col text-foreground bg-background overflow-hidden">
        <main className="flex-grow flex flex-col">
            <AuraPlayerView />
        </main>
        <footer className="fixed bottom-0 left-0 right-0 z-40">
            <PlayerBar />
        </footer>
    </div>
  );
}
