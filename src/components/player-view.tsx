'use client';
import React, { useContext } from 'react';
import ReactPlayer from 'react-player/lazy';
import { PlayerContext } from '@/context/player-context';
import { Music, PlayIcon } from '@/components/icons';

export const AuraPlayerView = () => {
  const context = useContext(PlayerContext);

  // If context is not available, render a loading or fallback state
  if (!context) {
    return (
      <div className="w-full aspect-video bg-muted/50 rounded-lg flex items-center justify-center relative shadow-inner">
        <Music className="w-12 h-12 text-muted-foreground/50"/>
      </div>
    );
  }

  const { currentSong, isPlaying, hasInteracted, isReady, activateSound } = context;

  return (
    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center relative shadow-xl">
      {currentSong ? (
        <>
          {/* This is the VISIBLE player, it acts as a "vitrine" */}
          {/* It's always muted; sound comes from the invisible player in the provider */}
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
                youtube: { playerVars: { showinfo: 0, modestbranding: 1, rel: 0 } },
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
          <Music className="w-12 h-12" />
          <p>Çalınacak bir şarkı seçin.</p>
        </div>
      )}
    </div>
  );
};
