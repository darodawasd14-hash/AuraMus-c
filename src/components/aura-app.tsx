'use client';
import React, { useState, useMemo } from 'react';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupLabel } from '@/components/ui/sidebar';
import { PlayerControls } from '@/components/player-controls';
import { usePlayer } from '@/context/player-context';
import { SongCard } from '@/components/song-card';
import { Input } from '@/components/ui/input';
import { Search, Library, ListMusic, Plus } from 'lucide-react';
import { AuraLogo } from '@/components/icons';
import { SmartPlaylistForm } from '@/components/smart-playlist-form';
import { Button } from '@/components/ui/button';

export function AuraApp() {
  const { songs, playlists, createPlaylist, setCurrentPlaylist, currentPlaylist: activePlaylist } = usePlayer();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState('Library');

  const handleCreatePlaylist = () => {
    const playlistName = prompt('Enter new playlist name:');
    if (playlistName && playlistName.trim() !== '') {
      const success = createPlaylist(playlistName);
      if(!success) {
        alert(`Playlist "${playlistName}" already exists.`);
      }
    }
  };

  const handleViewChange = (view: string) => {
    setActiveView(view);
    setCurrentPlaylist(view);
  }

  const displayedSongs = useMemo(() => {
    const sourceSongs = activeView === 'Library' ? songs : playlists.find(p => p.name === activeView)?.songs || [];
    if (!searchTerm) return sourceSongs;
    return sourceSongs.filter(song =>
      song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.album.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [songs, playlists, searchTerm, activeView]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background">
      <SidebarProvider>
        <Sidebar className="hidden border-r bg-muted/20 md:flex md:flex-col">
          <SidebarHeader className="border-b">
            <div className="flex items-center gap-2">
              <AuraLogo className="w-8 h-8 text-primary" />
              <h1 className="text-2xl font-headline font-bold">Aura</h1>
            </div>
          </SidebarHeader>
          <SidebarContent className="p-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={activeView === 'Library'} onClick={() => handleViewChange('Library')}>
                  <Library />
                  <span>Library</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarGroup className="mt-4">
              <SidebarGroupLabel asChild>
                <div className="flex items-center justify-between">
                  <span>Playlists</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCreatePlaylist}>
                    <Plus size={16}/>
                  </Button>
                </div>
              </SidebarGroupLabel>
              <SidebarMenu>
                {playlists.map(p => (
                   <SidebarMenuItem key={p.name}>
                     <SidebarMenuButton size="sm" isActive={activeView === p.name} onClick={() => handleViewChange(p.name)}>
                       <ListMusic />
                       <span>{p.name}</span>
                     </SidebarMenuButton>
                   </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <div className="mt-auto p-4 border-t">
              <SmartPlaylistForm />
          </div>
        </Sidebar>
        
        <SidebarInset className="flex flex-col">
          <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background/95 px-4 sm:px-6 backdrop-blur-sm z-10">
            <SidebarTrigger className="md:hidden" />
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search in your library..." 
                className="w-full max-w-md pl-9" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto pb-[120px] lg:pb-[96px]">
            <div className="p-4 sm:p-6 lg:p-8">
              <h2 className="text-3xl font-bold tracking-tight font-headline mb-6">{activeView}</h2>
              {displayedSongs.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7 gap-4 sm:gap-6">
                  {displayedSongs.map(song => <SongCard key={`${activeView}-${song.id}`} song={song} playlist={displayedSongs} />)}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-96 text-center text-muted-foreground">
                    <p className="text-lg font-medium">No songs found.</p>
                    <p className="text-sm">Try adjusting your search or add songs to this playlist.</p>
                </div>
              )}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
      <PlayerControls />
    </div>
  );
}
