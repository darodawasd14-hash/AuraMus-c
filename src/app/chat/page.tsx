'use client';
import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDoc, doc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ArrowLeft, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Chat {
  id: string;
  participantIds: string[];
  participantDetails: { [key: string]: { displayName: string } };
  lastMessage?: string;
  lastMessageTimestamp?: { seconds: number, nanoseconds: number };
}

export default function ChatsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const chatsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'chats'), where('participantIds', 'array-contains', user.uid));
  }, [user, firestore]);

  const { data: chats, isLoading: areChatsLoading } = useCollection<Chat>(chatsQuery);

  const [enrichedChats, setEnrichedChats] = useState<Chat[]>([]);
  const [isEnriching, setIsEnriching] = useState(true);

  useEffect(() => {
    if (chats && user && firestore) {
      setIsEnriching(true);
      const enrichPromises = chats.map(async (chat) => {
        const otherParticipantId = chat.participantIds.find(pId => pId !== user.uid);
        if (!otherParticipantId) return chat;

        const userDocRef = doc(firestore, 'users', otherParticipantId);
        const userDoc = await getDoc(userDocRef);

        const participantDetails = {
          ...chat.participantDetails,
          [otherParticipantId]: {
            displayName: userDoc.exists() ? userDoc.data().displayName : 'Bilinmeyen Kullanıcı',
          },
        };
        return { ...chat, participantDetails };
      });

      Promise.all(enrichPromises).then((newEnrichedChats) => {
        setEnrichedChats(newEnrichedChats);
        setIsEnriching(false);
      });
    } else if (!areChatsLoading) {
      setIsEnriching(false);
    }
  }, [chats, user, firestore, areChatsLoading]);
  
  const getChatId = (uid1: string, uid2: string) => {
    return [uid1, uid2].sort().join('_');
  };

  const isLoading = isUserLoading || areChatsLoading || isEnriching;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto p-4 md:p-8">
        <header className="flex items-center gap-4 mb-8">
           <Button onClick={() => router.push('/')} variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
           </Button>
           <div>
              <h1 className="text-3xl font-bold tracking-tight">Özel Sohbetler</h1>
              <p className="text-muted-foreground">Arkadaşlarınla olan konuşmaların</p>
           </div>
        </header>

        <main>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : enrichedChats.length > 0 ? (
            <div className="space-y-3">
              {enrichedChats.sort((a, b) => (b.lastMessageTimestamp?.seconds ?? 0) - (a.lastMessageTimestamp?.seconds ?? 0)).map(chat => {
                const otherParticipantId = chat.participantIds.find(pId => pId !== user?.uid);
                if (!otherParticipantId) return null;
                const otherParticipantName = chat.participantDetails[otherParticipantId]?.displayName || 'Yükleniyor...';

                return (
                  <Link href={`/chat/${getChatId(user!.uid, otherParticipantId)}`} key={chat.id}>
                    <Card className="hover:bg-secondary/50 transition-colors cursor-pointer">
                      <CardContent className="p-4 flex items-center gap-4">
                        <Avatar className="h-12 w-12 border-2 border-primary">
                          <AvatarImage src={`https://api.dicebear.com/8.x/bottts/svg?seed=${otherParticipantId}`} />
                          <AvatarFallback>{otherParticipantName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-grow">
                          <p className="font-semibold">{otherParticipantName}</p>
                          <p className="text-sm text-muted-foreground truncate">{chat.lastMessage || 'Henüz mesaj yok...'}</p>
                        </div>
                        {chat.lastMessageTimestamp && (
                           <p className="text-xs text-muted-foreground self-start">
                             {formatDistanceToNow(new Date(chat.lastMessageTimestamp.seconds * 1000), { addSuffix: true, locale: tr })}
                           </p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 text-center">
              <MessageCircle className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="font-semibold">Henüz hiç sohbetin yok</p>
              <p className="text-sm text-muted-foreground">"Arkadaşlar" sekmesinden bir arkadaşınla sohbet başlat.</p>
               <Button variant="outline" className="mt-4" onClick={() => router.push('/')}>
                  Ana Sayfaya Dön
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
