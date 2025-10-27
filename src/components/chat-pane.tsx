'use client';
import React, { useState, useEffect, FormEvent, useRef } from 'react';
import type { Song } from '@/context/player-context';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// Firestore'dan gelen mesajların arayüzü
interface Message {
    id: string;
    text: string;
    sender: {
        uid: string;
        displayName: string;
    };
    timestamp: any; // Firestore'un zaman damgası nesnesi
}

export function ChatPane({ song, displayName }: { song: Song | null, displayName?: string }) {
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Seçili şarkının sohbet mesajlarını getirmek için bir query oluştur
    const messagesQuery = useMemoFirebase(() => {
        if (!firestore || !song) return null;
        // Her şarkının kendi `messages` alt koleksiyonu olacak
        return query(
            collection(firestore, 'songs', song.id, 'messages'),
            orderBy('timestamp', 'asc'),
            limit(50)
        );
    }, [firestore, song]);

    const { data: messages, isLoading } = useCollection<Message>(messagesQuery);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = (e: FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !user || !firestore || !song) return;
        
        if (!displayName) {
            toast({ title: 'Sohbet etmek için profilinizde bir görünen ad belirlemelisiniz.', variant: 'destructive'});
            return;
        }

        setIsSending(true);

        const messagesColRef = collection(firestore, 'songs', song.id, 'messages');
        const messageData = {
            text: message,
            sender: {
                uid: user.uid,
                displayName: displayName,
            },
            timestamp: serverTimestamp(),
        };

        addDoc(messagesColRef, messageData)
            .then(() => {
                setMessage('');
            })
            .catch(serverError => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: messagesColRef.path,
                    operation: 'create',
                    requestResourceData: messageData,
                }));
            })
            .finally(() => {
                setIsSending(false);
            });
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
                {isLoading && (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="animate-spin text-primary" />
                    </div>
                )}
                {!isLoading && messages && messages.length === 0 && (
                    <div className="flex justify-center items-center h-full">
                        <p className="text-muted-foreground text-sm">İlk mesajı sen gönder!</p>
                    </div>
                )}
                {messages && messages.map(msg => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender.uid === user?.uid ? 'items-end' : 'items-start'}`}>
                        <div className={`p-2 rounded-lg max-w-xs ${msg.sender.uid === user?.uid ? 'bg-primary/90 text-primary-foreground' : 'bg-secondary'}`}>
                            <p className="text-xs font-bold text-accent mb-1">{msg.sender.displayName}</p>
                            <p className="text-sm break-words">{msg.text}</p>
                        </div>
                    </div>
                ))}
                 <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-border">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                        type="text"
                        placeholder="Bir şeyler söyle..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        disabled={!user || isSending || isLoading}
                        className="flex-grow"
                    />
                    <Button type="submit" size="icon" disabled={!user || isSending || !message.trim() || isLoading}>
                        {isSending ? <Loader2 className="animate-spin" /> : <Send />}
                    </Button>
                </form>
            </div>
        </aside>
    );
}
