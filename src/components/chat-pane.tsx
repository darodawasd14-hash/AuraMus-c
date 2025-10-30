'use client';
import React, { useState, useEffect, FormEvent, useRef } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, UserPlus, UserMinus, EyeOff, User as UserIcon, X, Menu } from 'lucide-react';
import Link from 'next/link';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { answerSongQuestion } from '@/ai/flows/song-qa-flow';
import { AuraLogo } from './icons';
import ReactMarkdown from 'react-markdown';
import type { Song } from '@/lib/types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Message {
    id: string;
    text: string;
    sender: {
        uid: string;
        displayName: string;
    };
    timestamp: any; 
    isAura?: boolean; 
}

interface ChatPaneProps {
    song: Song | null;
    onClose?: () => void;
    isVisible: boolean;
    isMobile: boolean;
}

export function ChatPane({ song, onClose, isVisible, isMobile }: ChatPaneProps) {
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const { user } = useUser();
    const firestore = useFirestore();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [ignoredUsers, setIgnoredUsers] = useState<string[]>([]);
    const { toast } = useToast();

    const [localMessages, setLocalMessages] = useState<Message[]>([]);

    const followingQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, 'users', user.uid, 'following');
    }, [user, firestore]);
    const { data: following, isLoading: isFollowingLoading } = useCollection<{uid: string}>(followingQuery);

    const messagesQuery = useMemoFirebase(() => {
        if (!firestore || !song?.id) return null; 
        return query(
            collection(firestore, 'songs', song.id, 'messages'),
            orderBy('timestamp', 'asc'),
            limit(50)
        );
    }, [firestore, song]);

    const { data: firestoreMessages, isLoading } = useCollection<Message>(messagesQuery);
    
    useEffect(() => {
        if (firestoreMessages) {
             const filteredMessages = firestoreMessages.filter(msg => !ignoredUsers.includes(msg.sender.uid));
            setLocalMessages(filteredMessages);
        } else if (!song) {
            setLocalMessages([]);
        }
    }, [firestoreMessages, song, ignoredUsers]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [localMessages]);
    
    const handleFollow = async (targetUserId: string) => {
        if (!user || !firestore) return;
        const followerRef = doc(firestore, 'users', targetUserId, 'followers', user.uid);
        const followingRefDoc = doc(firestore, 'users', user.uid, 'following', targetUserId);
        
        try {
            await setDoc(followerRef, { uid: user.uid });
            await setDoc(followingRefDoc, { uid: targetUserId });
        } catch (error) {
            console.error("Takip etme hatası:", error);
            toast({
                variant: 'destructive',
                title: "Hata",
                description: "Kullanıcı takip edilemedi."
            });
        }
    };

    const handleUnfollow = async (targetUserId: string) => {
        if (!user || !firestore) return;
        const followerRef = doc(firestore, 'users', targetUserId, 'followers', user.uid);
        const followingRefDoc = doc(firestore, 'users', user.uid, 'following', targetUserId);
        
        try {
            await deleteDoc(followerRef);
            await deleteDoc(followingRefDoc);
        } catch (error) {
             console.error("Takipten çıkarma hatası:", error);
            toast({
                variant: 'destructive',
                title: "Hata",
                description: "Kullanıcı takipten çıkarılamadı."
            });
        }
    };

    const handleIgnoreUser = (targetUserId: string) => {
        setIgnoredUsers(prev => [...prev, targetUserId]);
    };

    const isFollowingUser = (targetUserId: string) => {
        return following?.some(f => f.id === targetUserId) ?? false;
    };


    const handleSendMessage = async (e: FormEvent) => {
        e.preventDefault();
        const trimmedMessage = message.trim();
        if (!trimmedMessage || !user || !firestore || !song || !song.id) return;
        
        const senderDisplayName = user.displayName || (user.isAnonymous ? "Misafir Kullanıcı" : user.email) || "Kullanıcı";

        setIsSending(true);
        setMessage(''); 
        
        if (trimmedMessage.toLowerCase().startsWith('@aura')) {
            const question = trimmedMessage.substring(5).trim();

            const auraTypingId = `aura-typing-${Date.now()}`;
            const auraTypingMessage: Message = {
                id: auraTypingId,
                text: 'Aura düşünüyor...',
                sender: { uid: 'aura', displayName: 'Aura' },
                timestamp: new Date(),
                isAura: true,
            };
            setLocalMessages(prev => [...prev, auraTypingMessage]);
            
            try {
                const response = await answerSongQuestion({
                    songTitle: song.title,
                    question: question
                });
                
                const auraResponseMessage: Message = {
                    id: `aura-response-${Date.now()}`,
                    text: response.answer,
                    sender: { uid: 'aura', displayName: 'Aura' },
                    timestamp: new Date(),
                    isAura: true,
                };

                setLocalMessages(prev => prev.map(msg => msg.id === auraTypingId ? auraResponseMessage : msg));

            } catch (error) {
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
            const messagesColRef = collection(firestore, 'songs', song.id, 'messages');
            const messageData = {
                text: trimmedMessage,
                sender: {
                    uid: user.uid,
                    displayName: senderDisplayName,
                },
                timestamp: serverTimestamp(),
            };

            try {
                await addDoc(messagesColRef, messageData);
            } catch (error) {
                console.error("Mesaj gönderilemedi:", error);
                 toast({
                    variant: 'destructive',
                    title: "Hata",
                    description: "Mesajınız gönderilemedi. Lütfen tekrar deneyin."
                });
            }
        }
        
        setIsSending(false);
    };

    const UserActionsPopover = ({ msg }: { msg: Message }) => {
        if (!user || msg.sender.uid === user.uid || msg.isAura || !firestore) {
            return (
                <p className={`text-xs font-bold mb-1 ${msg.isAura ? 'text-accent' : 'text-muted-foreground'}`}>
                    {msg.sender.displayName}
                </p>
            );
        }

        const isFollowing = isFollowingUser(msg.sender.uid);

        return (
            <Popover>
                <PopoverTrigger asChild>
                    <p className={`text-xs font-bold mb-1 cursor-pointer hover:underline ${msg.isAura ? 'text-accent' : 'text-muted-foreground'}`}>
                        {msg.sender.displayName}
                    </p>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2">
                    <div className="flex flex-col gap-1">
                        <Button variant="ghost" size="sm" className="justify-start" asChild>
                           <Link href={`/profile/${msg.sender.uid}`}>
                              <UserIcon className="mr-2 h-4 w-4" />
                              Profili Görüntüle
                           </Link>
                        </Button>
                        {isFollowing ? (
                             <Button variant="ghost" size="sm" className="justify-start" onClick={() => handleUnfollow(msg.sender.uid)}>
                                <UserMinus className="mr-2 h-4 w-4" />
                                Takipten Çık
                            </Button>
                        ) : (
                             <Button variant="ghost" size="sm" className="justify-start" onClick={() => handleFollow(msg.sender.uid)}>
                                <UserPlus className="mr-2 h-4 w-4" />
                                Takip Et
                            </Button>
                        )}
                       <Button variant="ghost" size="sm" className="justify-start text-destructive hover:text-destructive" onClick={() => handleIgnoreUser(msg.sender.uid)}>
                            <EyeOff className="mr-2 h-4 w-4" />
                            Kullanıcıyı Gizle
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        );
    };
    
    if (!isVisible && !isMobile) {
        return null;
    }

    return (
        <div className={cn(
          "h-full w-full bg-background flex flex-col transition-transform duration-300 ease-in-out z-30",
          isMobile ? "fixed inset-0" : "relative border-l border-border w-96",
          isVisible ? "translate-x-0" : "translate-x-full"
        )}>
            <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
                <div>
                    {song ? (
                        <>
                            <h3 className="font-semibold truncate">{song.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1">Canlı Sohbet</p>
                        </>
                    ) : (
                         <h3 className="font-semibold truncate">Sohbet</h3>
                    )}
                </div>
                {onClose && (
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-5 h-5"/>
                    </Button>
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
                             {!msg.isAura && msg.sender.uid !== user?.uid && (
                                 <Avatar className="h-6 w-6 flex-shrink-0 mt-1">
                                     <AvatarFallback>{msg.sender.displayName.charAt(0)}</AvatarFallback>
                                 </Avatar>
                             )}
                            <div className={`flex flex-col ${msg.sender.uid === user?.uid ? 'items-end' : 'items-start'}`}>
                               <div className={`p-2 rounded-lg max-w-xs ${msg.sender.uid === user?.uid ? 'bg-primary/90 text-primary-foreground' : msg.isAura ? 'bg-muted' : 'bg-secondary'}`}>
                                    <UserActionsPopover msg={msg} />
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

            <div className="p-4 border-t border-border flex-shrink-0">
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
        </div>
    );
}
