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
import { answerSongQuestion } from '@/ai/flows/song-qa-flow';
import { AuraLogo } from './icons';
import ReactMarkdown from 'react-markdown';

// Firestore'dan gelen mesajların arayüzü
interface Message {
    id: string;
    text: string;
    sender: {
        uid: string;
        displayName: string;
    };
    timestamp: any; // Firestore'un zaman damgası nesnesi
    isAura?: boolean; // Bu mesajın Aura'dan gelip gelmediğini belirtir
}

export function ChatPane({ song, displayName }: { song: Song | null, displayName?: string }) {
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [localMessages, setLocalMessages] = useState<Message[]>([]);

    // Seçili şarkının sohbet mesajlarını getirmek için bir query oluştur
    const messagesQuery = useMemoFirebase(() => {
        if (!firestore || !song) return null;
        return query(
            collection(firestore, 'songs', song.id, 'messages'),
            orderBy('timestamp', 'asc'),
            limit(50)
        );
    }, [firestore, song]);

    const { data: firestoreMessages, isLoading } = useCollection<Message>(messagesQuery);
    
    useEffect(() => {
        // Firestore'dan gelen mesajları lokal duruma aktar
        if (firestoreMessages) {
            setLocalMessages(firestoreMessages);
        } else if (!song) {
            setLocalMessages([]);
        }
    }, [firestoreMessages, song]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [localMessages]);

    const handleSendMessage = async (e: FormEvent) => {
        e.preventDefault();
        const trimmedMessage = message.trim();
        if (!trimmedMessage || !user || !firestore || !song) return;
        
        // Use a fallback display name for guests or users without one.
        const senderDisplayName = displayName || (user.isAnonymous ? "Misafir Kullanıcı" : user.email) || "Kullanıcı";

        setIsSending(true);
        
        // Check if the message is a question for Aura
        if (trimmedMessage.toLowerCase().startsWith('@aura')) {
            const question = trimmedMessage.substring(5).trim();

            // Add a temporary "Aura is typing..." message
            const auraTypingId = `aura-typing-${Date.now()}`;
            const auraTypingMessage: Message = {
                id: auraTypingId,
                text: 'Aura düşünüyor...',
                sender: { uid: 'aura', displayName: 'Aura' },
                timestamp: new Date(),
                isAura: true,
            };
            setLocalMessages(prev => [...prev, auraTypingMessage]);
            setMessage('');
            
            try {
                const response = await answerSongQuestion({
                    songTitle: song.title,
                    question: question
                });
                
                // Replace the "typing" message with the actual answer
                const auraResponseMessage: Message = {
                    id: `aura-response-${Date.now()}`,
                    text: response.answer,
                    sender: { uid: 'aura', displayName: 'Aura' },
                    timestamp: new Date(),
                    isAura: true,
                };

                setLocalMessages(prev => prev.map(msg => msg.id === auraTypingId ? auraResponseMessage : msg));

            } catch (error) {
                 console.error("Aura'ya soru sorulurken hata:", error);
                 const errorMessage: Message = {
                    id: `aura-error-${Date.now()}`,
                    text: "Üzgünüm, şu an sorunuza cevap veremiyorum. Lütfen daha sonra tekrar deneyin.",
                    sender: { uid: 'aura', displayName: 'Aura' },
                    timestamp: new Date(),
                    isAura: true,
                 };
                 setLocalMessages(prev => prev.map(msg => msg.id === auraTypingId ? errorMessage : msg));
            }

        } else {
            // Normal chat message
            const messagesColRef = collection(firestore, 'songs', song.id, 'messages');
            const messageData = {
                text: trimmedMessage,
                sender: {
                    uid: user.uid,
                    displayName: senderDisplayName,
                },
                timestamp: serverTimestamp(),
            };

            setMessage(''); // Clear input immediately
            await addDoc(messagesColRef, messageData)
                .catch(serverError => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: messagesColRef.path,
                        operation: 'create',
                        requestResourceData: messageData,
                    }));
                });
        }
        
        setIsSending(false);
    };

    return (
        <aside className="h-full w-full bg-background/50 border-l border-border flex flex-col">
            <div className="p-4 border-b border-border">
                {song ? (
                    <>
                        <h3 className="font-semibold truncate">{song.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">Canlı Sohbet</p>
                    </>
                ) : (
                     <h3 className="font-semibold truncate">Sohbet</h3>
                )}
            </div>

            <div className="flex-grow p-4 overflow-y-auto space-y-4">
                 {!song ? (
                    <div className="flex flex-col justify-center items-center h-full text-center">
                        <p className="text-muted-foreground">Sohbeti görmek için bir şarkı çalın.</p>
                    </div>
                ) : isLoading && localMessages.length === 0 ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="animate-spin text-primary" />
                    </div>
                ) : !isLoading && localMessages.length === 0 ? (
                    <div className="flex flex-col justify-center items-center h-full text-center">
                        <p className="text-muted-foreground text-sm">İlk mesajı sen gönder!</p>
                        <p className="text-muted-foreground text-xs mt-2">Aura'ya sormak için: <code className="bg-muted px-1 py-0.5 rounded-sm">@aura soru</code></p>
                    </div>
                ) : (
                    localMessages.map(msg => (
                        <div key={msg.id} className={`flex gap-3 ${msg.sender.uid === user?.uid ? 'justify-end' : 'justify-start'}`}>
                             {msg.isAura && (
                                <AuraLogo className="w-6 h-6 flex-shrink-0 mt-1" />
                            )}
                            <div className={`flex flex-col ${msg.sender.uid === user?.uid ? 'items-end' : 'items-start'}`}>
                               <div className={`p-2 rounded-lg max-w-xs ${msg.sender.uid === user?.uid ? 'bg-primary/90 text-primary-foreground' : msg.isAura ? 'bg-muted' : 'bg-secondary'}`}>
                                    <p className={`text-xs font-bold mb-1 ${msg.isAura ? 'text-accent' : 'text-muted-foreground'}`}>{msg.sender.displayName}</p>
                                    <div className="text-sm break-words prose prose-sm prose-invert">
                                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                                    </div>
                                </div>
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
                        placeholder="@aura sor veya sohbet et..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        disabled={!user || isSending || isLoading || !song}
                        className="flex-grow"
                    />
                    <Button type="submit" size="icon" disabled={!user || isSending || !message.trim() || isLoading || !song}>
                        {isSending ? <Loader2 className="animate-spin" /> : <Send />}
                    </Button>
                </form>
            </div>
        </aside>
    );
}
