'use client';
import { useState, useEffect, useMemo, FormEvent, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, orderBy, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, ArrowLeft, Users, MessageCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Chat {
    id: string;
    participantIds: string[];
    lastMessage?: string;
    lastMessageTimestamp?: any;
    // We need participant details that are not in the chat doc itself
    otherParticipant?: {
        id: string;
        displayName: string;
    }
}

interface Message {
    id: string;
    text: string;
    sender: {
        uid: string;
        displayName: string;
    };
    timestamp: any;
}

// ================= CHAT LIST COMPONENT =================
function ChatList({ chats, onSelectChat, activeChatId }: { chats: Chat[] | null, onSelectChat: (chat: Chat) => void, activeChatId?: string | null }) {
    const { user } = useUser();
    
    if (!chats) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <Users className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="font-semibold">Henüz sohbet yok</p>
                <p className="text-sm text-muted-foreground">Takip ettiğiniz bir arkadaşınızın profilinden mesaj göndererek yeni bir sohbet başlatın.</p>
            </div>
        );
    }
    
    return (
        <div className="space-y-2">
            {chats.map(chat => (
                <div
                    key={chat.id}
                    onClick={() => onSelectChat(chat)}
                    className={cn(
                        "flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors hover:bg-secondary/80",
                        activeChatId === chat.id && "bg-secondary"
                    )}
                >
                    <Avatar>
                        <AvatarImage src={`https://api.dicebear.com/8.x/bottts/svg?seed=${chat.otherParticipant?.id}`} />
                        <AvatarFallback>{chat.otherParticipant?.displayName?.charAt(0) || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-grow overflow-hidden">
                        <p className="font-semibold truncate">{chat.otherParticipant?.displayName || 'Kullanıcı'}</p>
                        <p className="text-sm text-muted-foreground truncate">{chat.lastMessage}</p>
                    </div>
                    {chat.lastMessageTimestamp && (
                         <p className="text-xs text-muted-foreground flex-shrink-0">
                            {formatDistanceToNow(chat.lastMessageTimestamp.toDate(), { addSuffix: true, locale: tr })}
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
}

// ================= MESSAGE PANE COMPONENT =================
function MessagePane({ activeChat }: { activeChat: Chat }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const messagesQuery = useMemoFirebase(() => {
        if (!firestore || !activeChat) return null;
        return query(collection(firestore, 'chats', activeChat.id, 'messages'), orderBy('timestamp', 'asc'));
    }, [firestore, activeChat]);
    
    const { data: messages, isLoading: isMessagesLoading } = useCollection<Message>(messagesQuery);
    
     useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);


    const handleSendMessage = async (e: FormEvent) => {
        e.preventDefault();
        const text = newMessage.trim();
        if (!text || !user || !firestore || !activeChat) return;

        setIsSending(true);
        setNewMessage('');

        const messageData = {
            text,
            sender: {
                uid: user.uid,
                displayName: user.displayName || user.email || 'Kullanıcı',
            },
            timestamp: serverTimestamp(),
        };

        const messagesColRef = collection(firestore, 'chats', activeChat.id, 'messages');
        const chatDocRef = doc(firestore, 'chats', activeChat.id);

        try {
            await addDoc(messagesColRef, messageData);
            await updateDoc(chatDocRef, {
                lastMessage: text,
                lastMessageTimestamp: serverTimestamp(),
            });
        } catch (serverError) {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: messagesColRef.path, // or chatDocRef.path
                operation: 'create',
                requestResourceData: messageData,
            }));
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <header className="p-4 border-b border-border flex items-center gap-4">
                 <Avatar>
                    <AvatarImage src={`https://api.dicebear.com/8.x/bottts/svg?seed=${activeChat.otherParticipant?.id}`} />
                    <AvatarFallback>{activeChat.otherParticipant?.displayName?.charAt(0) || '?'}</AvatarFallback>
                </Avatar>
                <div>
                     <h2 className="font-semibold text-lg">{activeChat.otherParticipant?.displayName || 'Sohbet'}</h2>
                     <p className="text-sm text-muted-foreground">Özel Mesaj</p>
                </div>
            </header>
            <div className="flex-grow p-4 overflow-y-auto space-y-4">
                {isMessagesLoading && <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin" /></div>}
                {!isMessagesLoading && messages?.map(msg => (
                    <div key={msg.id} className={`flex gap-3 ${msg.sender.uid === user?.uid ? 'justify-end' : 'justify-start'}`}>
                         {!msg.sender.uid || (msg.sender.uid !== user?.uid && (
                            <Avatar className="h-6 w-6 flex-shrink-0 mt-1">
                               <AvatarImage src={`https://api.dicebear.com/8.x/bottts/svg?seed=${msg.sender.uid}`} />
                               <AvatarFallback>{msg.sender.displayName.charAt(0)}</AvatarFallback>
                            </Avatar>
                        ))}
                       <div className={`flex flex-col ${msg.sender.uid === user?.uid ? 'items-end' : 'items-start'}`}>
                          <div className={`p-3 rounded-lg max-w-sm ${msg.sender.uid === user?.uid ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                               <p className="text-sm break-words">{msg.text}</p>
                           </div>
                           <p className="text-xs text-muted-foreground mt-1 px-1">
                             {msg.timestamp ? formatDistanceToNow(msg.timestamp.toDate(), { addSuffix: true, locale: tr }) : 'şimdi'}
                           </p>
                       </div>
                   </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
             <div className="p-4 border-t border-border">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Mesajınızı yazın..."
                        disabled={isSending || isMessagesLoading}
                    />
                    <Button type="submit" size="icon" disabled={isSending || isMessagesLoading || !newMessage}>
                        {isSending ? <Loader2 className="animate-spin" /> : <Send />}
                    </Button>
                </form>
            </div>
        </div>
    );
}

// ================= MAIN CHAT PAGE COMPONENT =================
function ChatPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const [activeChat, setActiveChat] = useState<Chat | null>(null);

    // This is the SAFE query for the chat list
    const chatsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'chats'),
            where('participantIds', 'array-contains', user.uid),
            orderBy('lastMessageTimestamp', 'desc')
        );
    }, [user, firestore]);

    const { data: rawChats, isLoading: isChatsLoading } = useCollection<Chat>(chatsQuery);

    const [hydratedChats, setHydratedChats] = useState<Chat[] | null>(null);

    // Effect to enrich chats with participant details
    useEffect(() => {
        if (!rawChats || !user || !firestore) return;

        const fetchParticipantDetails = async () => {
            const enrichedChats = await Promise.all(
                rawChats.map(async (chat) => {
                    const otherUserId = chat.participantIds.find(id => id !== user.uid);
                    if (!otherUserId) return chat;

                    const userDocRef = doc(firestore, 'users', otherUserId);
                    const userDocSnap = await getDoc(userDocRef);

                    if (userDocSnap.exists()) {
                        return {
                            ...chat,
                            otherParticipant: {
                                id: otherUserId,
                                displayName: userDocSnap.data().displayName || 'Kullanıcı',
                            },
                        };
                    }
                    return chat;
                })
            );
            setHydratedChats(enrichedChats);
        };

        fetchParticipantDetails();
    }, [rawChats, user, firestore]);
    
    // Effect to set active chat from URL param
    useEffect(() => {
        const chatId = searchParams.get('chatId');
        if (chatId && hydratedChats) {
            const chatFromUrl = hydratedChats.find(c => c.id === chatId);
            if (chatFromUrl) {
                setActiveChat(chatFromUrl);
            }
        }
    }, [searchParams, hydratedChats]);

    const handleSelectChat = (chat: Chat) => {
        setActiveChat(chat);
        router.push(`/chat?chatId=${chat.id}`, { scroll: false });
    };

    if (isUserLoading || (isChatsLoading && !hydratedChats)) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin" /></div>;
    }

    return (
        <div className="h-screen w-screen flex flex-col text-foreground bg-background overflow-hidden">
            <header className="flex-shrink-0 bg-secondary/30 border-b border-border px-6 py-3 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                     <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
                        <ArrowLeft />
                     </Button>
                     <div>
                        <h1 className="text-xl font-bold">Sohbetler</h1>
                        <p className="text-sm text-muted-foreground">Arkadaşlarınızla özel olarak mesajlaşın</p>
                     </div>
                 </div>
            </header>
            <div className="flex flex-1 min-h-0">
                <aside className="w-1/3 border-r border-border p-4 overflow-y-auto">
                    <ChatList chats={hydratedChats} onSelectChat={handleSelectChat} activeChatId={activeChat?.id} />
                </aside>
                <main className="w-2/3">
                    {activeChat ? (
                        <MessagePane activeChat={activeChat} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8">
                            <MessageCircle className="w-16 h-16 text-muted-foreground mb-4" />
                            <h2 className="text-2xl font-semibold">Bir sohbet seçin</h2>
                            <p className="text-muted-foreground mt-2">Görüntülemek için kenar çubuğundan bir sohbet seçin veya yeni bir tane başlatın.</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

export default function ChatPage() {
    return (
        <Suspense fallback={<div className="flex h-full w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin" /></div>}>
            <ChatPageContent />
        </Suspense>
    )
}
