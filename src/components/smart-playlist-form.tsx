'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2 } from 'lucide-react';
import { suggestSmartPlaylist, type SmartPlaylistOutput } from '@/ai/flows/smart-playlist-suggestions';
import { usePlayer } from '@/context/player-context';
import { useToast } from '@/hooks/use-toast';
import type { Song } from '@/lib/data';

export function SmartPlaylistForm() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { songs, addPlaylist } = usePlayer();
  const { toast } = useToast();

  const defaultListeningHistory = songs
    .slice(0, 5)
    .map(s => `${s.title} by ${s.artist}`)
    .join(', ');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const listeningHistory = formData.get('listeningHistory') as string;
    const playlistLength = Number(formData.get('playlistLength'));

    try {
      const result: SmartPlaylistOutput = await suggestSmartPlaylist({
        listeningHistory,
        playlistLength,
      });

      const newPlaylistSongs: Song[] = result.songList.map((songTitle, index) => {
          const [title, artist] = songTitle.split(' by ');
          const existingSong = songs.find(s => s.title === title.trim() && s.artist === artist.trim());
          if (existingSong) return existingSong;

          // Create a mock song if it doesn't exist in the library
          const randomSong = songs[Math.floor(Math.random() * songs.length)];
          return {
              id: `gen-${Date.now()}-${index}`,
              title: title.trim(),
              artist: artist ? artist.trim() : 'Unknown Artist',
              album: result.playlistName,
              duration: '3:30',
              durationSeconds: 210,
              coverArt: randomSong.coverArt,
              coverArtHint: randomSong.coverArtHint
          }
      });
      
      addPlaylist({ name: result.playlistName, songs: newPlaylistSongs });

      toast({
        title: "Playlist Generated!",
        description: `"${result.playlistName}" has been added to your playlists.`,
      });
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: "Uh oh! Something went wrong.",
        description: "There was a problem generating your playlist.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          <Sparkles className="mr-2 h-4 w-4 text-accent-foreground" />
          <span>Smart Playlist</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create a Smart Playlist</DialogTitle>
            <DialogDescription>
              Let AI create a playlist for you based on your listening habits.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="listeningHistory" className="text-right col-span-4 text-left mb-[-8px]">
                Listening History
              </Label>
              <Textarea
                id="listeningHistory"
                name="listeningHistory"
                defaultValue={defaultListeningHistory}
                className="col-span-4"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="playlistLength" className="text-right">
                Length
              </Label>
              <Input
                id="playlistLength"
                name="playlistLength"
                type="number"
                defaultValue="10"
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Playlist'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
