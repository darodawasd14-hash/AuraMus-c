'use client';
import React, { useState, useEffect, FormEvent, useRef } from 'react';
import type { Song } from '@/context/player-context';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Basitleştirilmiş Mesaj arayüzü
interface Message {
    id: string;
    text: string;
    sender: {
        uid: string;
        displayName: string;
    };
    timestamp: Date; // Native Date nesnesi kullanılıyor
}

export function ChatPane({ song, displayName }: { song: Song | null, displayName?: string }) {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isSending, setIsSending] = useState(false);
    const { user } = useUser();
    const { toast } = useToast();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [currentSongId, setCurrentSongId] = useState<string | null>(null);

    // Şarkı değiştiğinde mesajları temizle
    useEffect(() => {
        if (song?.id !== currentSongId) {
            setMessages([]);
            setCurrentSongId(song?.id ?? null);
        }
    }, [song, currentSongId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !user) return;
        
        if (!displayName) {
            toast({ title: 'Sohbet etmek için profilinizde bir görünen ad belirlemelisiniz.', variant: 'destructive'});
            return;
        }

        setIsSending(true);

        const newMessage: Message = {
            id: new Date().toISOString(),
            text: message,
            sender: {
                uid: user.uid,
                displayName: displayName,
            },
            timestamp: new Date(),
        };

        // Ağ gecikmesini simüle et
        await new Promise(resolve => setTimeout(resolve, 300));

        setMessages(prevMessages => [...prevMessages, newMessage]);
        setMessage('');
        setIsSending(false);
    };

    if (!song) {
        return (
            <aside className="w-80 bg-background/50 border-l border-border flex flex-col p-4 justify-center items-center text-center">
                <p className="text-muted-foreground">Sohbeti görmek için bir şarkı seçin.</p>
            </aside>
        );
    }
    
    return (
        <aside className="w-80 bg-background/50 border-l border-border flex flex-col">
            <div className="p-4 border-b border-border">
                <h3 className="font-semibold truncate">{song.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">Canlı Sohbet</p>
            </div>

            <div className="flex-grow p-4 overflow-y-auto space-y-4">
                {messages.length === 0 ? (
                    <div className="flex justify-center items-center h-full">
                        <p className="text-muted-foreground text-sm">İlk mesajı sen gönder!</p>
                    </div>
                ) : (
                    messages.map(msg => (
                        <div key={msg.id} className={`flex flex-col ${msg.sender.uid === user?.uid ? 'items-end' : 'items-start'}`}>
                            <div className={`p-2 rounded-lg max-w-xs ${msg.sender.uid === user?.uid ? 'bg-primary/90 text-primary-foreground' : 'bg-secondary'}`}>
                                <p className="text-xs font-bold text-accent mb-1">{msg.sender.displayName}</p>
                                <p className="text-sm">{msg.text}</p>
                            </div>
                        </div>
                    ))
                )}
                 <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-border">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                        type="text"
                        placeholder="Bir şeyler söyle..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        disabled={!user || isSending}
                        className="flex-grow"
                    />
                    <Button type="submit" size="icon" disabled={!user || isSending || !message.trim()}>
                        {isSending ? <Loader2 className="animate-spin" /> : <Send />}
                    </Button>
                </form>
            </div>
        </aside>
    );
}
