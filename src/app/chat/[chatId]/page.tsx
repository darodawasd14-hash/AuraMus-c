'use client';

import React, { useState, useEffect, FormEvent, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, useDoc } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, ArrowLeft } from 'lucide-react';
import { collection, addDoc, serverTimestamp, query, orderBy, doc, setDoc } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  text: string;
  sender: {
    uid: string;
    displayName: string;
  };
  timestamp: any;
}

interface ParticipantProfile {
    displayName: string;
}

export default function PrivateChatPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const params = useParams();
  const chatId = params.chatId as string;
  const { toast } = useToast();

  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const otherParticipantId = useMemo(() => {
    if (!chatId || !user) return null;
    const participantIds = chatId.split('_');
    return participantIds.find(id => id !== user.uid);
  }, [chatId, user]);

  const otherParticipantRef = useMemoFirebase(() => {
    if (!firestore || !otherParticipantId) return null;
    return doc(firestore, 'users', otherParticipantId);
  }, [firestore, otherParticipantId]);

  const { data: otherParticipant, isLoading: isLoadingParticipant } = useDoc<ParticipantProfile>(otherParticipantRef);

  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !chatId) return null;
    return query(collection(firestore, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
  }, [firestore, chatId]);

  const { data: messages, isLoading: areMessagesLoading } = useCollection<Message>(messagesQuery);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || !user || !firestore || !chatId || isSending) return;

    setIsSending(true);
    
    const senderDisplayName = user.displayName || (user.isAnonymous ? "Misafir Kullanıcı" : user.email) || "Kullanıcı";
    
    const messagesColRef = collection(firestore, 'chats', chatId, 'messages');
    const messageData = {
      text: trimmedMessage,
      sender: {
        uid: user.uid,
        displayName: senderDisplayName,
      },
      timestamp: serverTimestamp(),
    };
    
    const chatDocRef = doc(firestore, 'chats', chatId);
    const chatData = {
      participantIds: chatId.split('_').sort(),
      lastMessage: trimmedMessage,
      lastMessageTimestamp: serverTimestamp(),
    };
    
    setMessage('');

    addDoc(messagesColRef, messageData)
        .then(() => {
            setDoc(chatDocRef, chatData, { merge: true }).catch(serverError => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: chatDocRef.path,
                    operation: 'write',
                    requestResourceData: chatData,
                }));
                toast({
                    variant: "destructive",
                    title: "Sohbet Güncellenemedi",
                    description: "Mesajınız gönderildi ancak sohbet önizlemesi güncellenirken bir hata oluştu.",
                });
            });
        })
        .catch(serverError => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: messagesColRef.path,
                operation: 'create',
                requestResourceData: messageData,
            }));
            toast({
                variant: "destructive",
                title: "Mesaj Gönderilemedi",
                description: "Mesajınız gönderilemedi. Lütfen daha sonra tekrar deneyin.",
            });
        })
        .finally(() => {
            setIsSending(false);
        });
  };
  
  const isLoading = isUserLoading || areMessagesLoading || isLoadingParticipant;
  const otherParticipantName = otherParticipant?.displayName || `Kullanıcı ${otherParticipantId?.substring(0, 6) || ''}`;

  return (
    <div className="h-screen bg-background text-foreground flex flex-col">
       <header className="p-4 border-b border-border flex items-center gap-4 flex-shrink-0">
          <Button onClick={() => router.push('/chat')} variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
          </Button>
          {otherParticipantId ? (
              <Link href={`/profile/${otherParticipantId}`} className="flex items-center gap-3 cursor-pointer">
                 <Avatar className="h-10 w-10 border-2 border-primary">
                    <AvatarImage src={`https://api.dicebear.com/8.x/bottts/svg?seed=${otherParticipantId}`} />
                    <AvatarFallback>{otherParticipantName.charAt(0)}</AvatarFallback>
                 </Avatar>
                 <h2 className="font-semibold text-lg">{isLoading ? 'Yükleniyor...' : otherParticipantName}</h2>
              </Link>
          ) : isLoading ? (
              <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-muted rounded-full animate-pulse" />
                  <div className="h-5 w-32 bg-muted rounded-md animate-pulse" />
              </div>
          ) : (
             <h2 className="font-semibold text-lg">Sohbet</h2>
          )}
       </header>

       <main className="flex-grow p-4 overflow-y-auto space-y-4">
           {isLoading && !messages ? (
               <div className="flex justify-center items-center h-full">
                  <Loader2 className="animate-spin text-primary h-8 w-8" />
               </div>
           ) : messages && messages.length > 0 ? (
               messages.map(msg => (
                   <div key={msg.id} className={`flex gap-3 ${msg.sender.uid === user?.uid ? 'justify-end' : 'justify-start'}`}>
                       {msg.sender.uid !== user?.uid && (
                           <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                               <AvatarImage src={`https://api.dicebear.com/8.x/bottts/svg?seed=${msg.sender.uid}`} />
                               <AvatarFallback>{msg.sender.displayName.charAt(0)}</AvatarFallback>
                           </Avatar>
                       )}
                       <div className={`flex flex-col ${msg.sender.uid === user?.uid ? 'items-end' : 'items-start'}`}>
                          <div className={`p-3 rounded-lg max-w-sm md:max-w-md ${msg.sender.uid === user?.uid ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                               { msg.sender.uid !== user?.uid && <p className="text-xs font-bold mb-1 text-muted-foreground">{msg.sender.displayName}</p> }
                               <p className="text-sm break-words">{msg.text}</p>
                           </div>
                       </div>
                   </div>
               ))
           ) : (
                <div className="flex flex-col justify-center items-center h-full text-center">
                    <p className="text-muted-foreground">Henüz mesaj yok.</p>
                    <p className="text-muted-foreground text-sm">İlk mesajı göndererek sohbeti başlat!</p>
                </div>
           )}
           <div ref={messagesEndRef} />
       </main>

       <footer className="p-4 border-t border-border flex-shrink-0">
           <form onSubmit={handleSendMessage} className="flex gap-2">
               <Input
                   type="text"
                   placeholder="Bir mesaj yaz..."
                   value={message}
                   onChange={(e) => setMessage(e.target.value)}
                   disabled={!user || isSending || isLoading}
                   className="flex-grow"
               />
               <Button type="submit" size="icon" disabled={!user || isSending || !message.trim() || isLoading}>
                   {isSending ? <Loader2 className="animate-spin" /> : <Send />}
               </Button>
           </form>
       </footer>
    </div>
  );
}
