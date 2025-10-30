'use client';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoc } from '@/firebase';

interface Chat {
  id: string;
  participantIds: string[];
  lastMessage?: string;
  lastMessageTimestamp?: { seconds: number, nanoseconds: number };
}

const ChatListItem = ({ chat }: { chat: Chat }) => {
    const { user } = useUser();
    const firestore = useFirestore();

    const otherParticipantId = chat.participantIds.find(pId => pId !== user?.uid);

    const participantProfileRef = useMemoFirebase(() => {
        if (!firestore || !otherParticipantId) return null;
        return doc(firestore, 'users', otherParticipantId);
    }, [firestore, otherParticipantId]);

    const { data: participantProfile, isLoading: isProfileLoading } = useDoc<{ displayName: string }>(participantProfileRef);

    if (!otherParticipantId) return null;

    const getChatId = (uid1: string, uid2: string) => {
        return [uid1, uid2].sort().join('_');
    };
    
    const displayName = participantProfile?.displayName || `Kullanıcı ${otherParticipantId.substring(0, 6)}`;
    const fallback = displayName.charAt(0).toUpperCase();

    return (
        <Link href={`/chat/${getChatId(user!.uid, otherParticipantId)}`} key={chat.id}>
            <Card className="hover:bg-secondary/50 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-4">
                    {isProfileLoading ? (
                        <Skeleton className="h-12 w-12 rounded-full" />
                    ) : (
                        <Avatar className="h-12 w-12 border-2 border-primary">
                            <AvatarImage src={`https://api.dicebear.com/8.x/bottts/svg?seed=${otherParticipantId}`} />
                            <AvatarFallback>{fallback}</AvatarFallback>
                        </Avatar>
                    )}
                    <div className="flex-grow">
                        {isProfileLoading ? (
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-48" />
                            </div>
                        ) : (
                           <>
                            <p className="font-semibold">{displayName}</p>
                            <p className="text-sm text-muted-foreground truncate">{chat.lastMessage || 'Henüz mesaj yok...'}</p>
                           </>
                        )}
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
};


export default function ChatsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const chatsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    // SECURE QUERY: Only fetch chats where the current user is a participant.
    return query(
        collection(firestore, "chats"), 
        where("participantIds", "array-contains", user.uid),
        orderBy('lastMessageTimestamp', 'desc')
    );
  }, [user, firestore]);

  const { data: chats, isLoading: areChatsLoading, error } = useCollection<Chat>(chatsQuery);

  if (error) {
      console.error("Secure chat query failed:", error);
  }

  const isLoading = isUserLoading || areChatsLoading;

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
             <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Card key={i}><CardContent className="p-4 flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-grow space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </CardContent></Card>
              ))}
            </div>
          ) : chats && chats.length > 0 ? (
            <div className="space-y-3">
              {chats.map(chat => (
                    <ChatListItem key={chat.id} chat={chat} />
                ))}
            </div>
          ) : !isLoading && error ? (
             <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-destructive/50 p-12 text-center">
              <MessageCircle className="mb-4 h-12 w-12 text-destructive" />
              <p className="font-semibold text-destructive">Sohbetler Yüklenemedi</p>
              <p className="text-sm text-muted-foreground">Bir hata oluştu. Lütfen konsol loglarını kontrol edin.</p>
               <p className="text-xs text-muted-foreground mt-2">Not: Eğer hata "FAILED_PRECONDITION" ise, Firebase konsolunda bir dizin (index) oluşturmanız gerekmektedir.</p>
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
    