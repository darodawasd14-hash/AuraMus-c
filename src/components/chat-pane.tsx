'use client';
import React, { useState, useEffect, FormEvent, useRef } from 'react';
import type { Song } from '@/context/player-context';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

const appId = 'Aura';

interface Message {
    id: string;
    text: string;
    sender: {
        uid: string;
        displayName: string;
    };
    timestamp: Timestamp;
}

export function ChatPane({ song, displayName }: { song: Song | null, displayName?: string }) {
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const messagesCollectionRef = useMemoFirebase(() => {
        if (!song || !firestore) return null;
        return collection(firestore, 'artifacts', appId, 'songs', song.id, 'messages');
    }, [song, firestore]);

    const messagesQuery = useMemoFirebase(() => {
        if (!messagesCollectionRef) return null;
        return query(messagesCollectionRef, orderBy('timestamp', 'asc'));
    }, [messagesCollectionRef]);

    const { data: messages, isLoading: isMessagesLoading } = useCollection<Message>(messagesQuery);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !user || !messagesCollectionRef) return;
        
        if (!displayName) {
            toast({ title: 'Sohbet edebilmek için profilinizde bir görünen ad belirlemelisiniz.', variant: 'destructive'});
            return;
        }

        setIsSending(true);
        const newMessage = {
            text: message,
            sender: {
                uid: user.uid,
                displayName: displayName,
            },
            timestamp: serverTimestamp(),
        };

        addDoc(messagesCollectionRef, newMessage)
            .then(() => {
                setMessage('');
            })
            .catch((serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: messagesCollectionRef.path,
                    operation: 'create',
                    requestResourceData: newMessage,
                });
                errorEmitter.emit('permission-error', permissionError);
                toast({ title: 'Mesaj gönderilirken bir hata oluştu.', variant: 'destructive' });
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
                <p className="text-sm text-muted-foreground mt-1">Sohbet</p>
            </div>

            <div className="flex-grow p-4 overflow-y-auto space-y-4">
                {isMessagesLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    messages?.map(msg => (
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
