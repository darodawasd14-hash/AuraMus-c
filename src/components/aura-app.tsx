'use client';
import React, { useState } from 'react';
import { PlayerProvider } from '@/context/player-context';
import { Home, ListMusic, MessageSquare, Users, AuraLogo, Plus } from '@/components/icons';
import Image from 'next/image';
import { AuraPlayerView } from '@/components/player-view';
import { PlaylistView } from '@/components/playlist-view';
import { ChatPane } from '@/components/chat-pane';

const SideNav = () => (
    <aside className="w-64 flex flex-col bg-secondary/30 border-r border-border p-4">
        <div className="flex items-center gap-2 mb-8 px-2">
            <AuraLogo className="w-8 h-8" />
            <h1 className="text-xl font-bold tracking-tighter">Aura</h1>
        </div>
        <nav className="flex flex-col gap-2">
            <a href="#" className="flex items-center gap-3 px-3 py-2 text-primary bg-primary/10 rounded-md">
                <Home className="w-5 h-5" />
                <span className="font-semibold">Keşfet</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-foreground transition-colors">
                <ListMusic className="w-5 h-5" />
                <span className="font-medium">Çalma Listelerim</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-foreground transition-colors">
                <MessageSquare className="w-5 h-5" />
                <span className="font-medium">Sohbet</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-foreground transition-colors">
                <Users className="w-5 h-5" />
                <span className="font-medium">Arkadaşlar</span>
            </a>
        </nav>
    </aside>
);


export function AuraApp() {
    return (
        <PlayerProvider>
            <div id="app-container" className="h-screen w-screen flex text-foreground bg-background overflow-hidden">
                <SideNav />
                <main className="flex-1 flex flex-col p-8 gap-8 overflow-y-auto">
                   <div className="flex-shrink-0">
                     <AuraPlayerView />
                   </div>
                   <div className="flex-grow flex flex-col">
                     <PlaylistView />
                   </div>
                </main>
                 <aside className="w-96 border-l border-border">
                    <ChatPane />
                 </aside>
            </div>
        </PlayerProvider>
    );
}