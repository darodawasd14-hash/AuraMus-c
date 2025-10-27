'use client';

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayCircle, MoreHorizontal, PlusCircle } from 'lucide-react';
import { usePlayer } from '@/context/player-context';
import type { Song } from '@/lib/data';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from '@/hooks/use-toast';

type SongCardProps = {
  song: Song;
  playlist: Song[];
};

export function SongCard({ song, playlist }: SongCardProps) {
  const { playSong, playlists, addSongToPlaylist } = usePlayer();
  const { toast } = useToast();

  const handlePlay = () => {
    playSong(song, playlist);
  };
  
  const handleAddToPlaylist = (playlistName: string) => {
    addSongToPlaylist(playlistName, song);
    toast({
      title: "Song Added",
      description: `"${song.title}" was added to "${playlistName}".`,
    });
  }

  return (
    <Card className="group relative w-full overflow-hidden border-0 shadow-none bg-transparent">
      <CardContent className="p-0">
        <div className="aspect-square relative">
          <Image
            src={song.coverArt}
            alt={song.album}
            width={300}
            height={300}
            className="rounded-md object-cover transition-transform duration-300 group-hover:scale-105"
            data-ai-hint={song.coverArtHint}
          />
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-16 w-16 text-white hover:bg-white/20"
              onClick={handlePlay}
            >
              <PlayCircle className="h-12 w-12" />
            </Button>
          </div>
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 bg-black/30 text-white hover:bg-black/50 hover:text-white">
                  <MoreHorizontal size={20} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    <span>Add to playlist</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      {playlists.length > 0 ? (
                        playlists.map(p => (
                          <DropdownMenuItem key={p.name} onClick={() => handleAddToPlaylist(p.name)}>
                            {p.name}
                          </DropdownMenuItem>
                        ))
                      ) : (
                        <DropdownMenuItem disabled>No playlists yet</DropdownMenuItem>
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="mt-2">
          <h3 className="font-semibold text-sm truncate font-headline">{song.title}</h3>
          <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
        </div>
      </CardContent>
    </Card>
  );
}
