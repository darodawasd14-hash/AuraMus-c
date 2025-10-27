'use client';
import { useState } from 'react';
import { useAuth } from '@/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuraLogo } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const auth = useAuth();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleAuth(signInWithEmailAndPassword, email, password, "Başarıyla giriş yapıldı!");
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleAuth(createUserWithEmailAndPassword, registerEmail, registerPassword, "Başarıyla kayıt olundu!");
  }

  const handleAuth = async (authFn: Function, emailParam: string, passwordParam: string, successMessage: string) => {
    setError(null);
    setIsLoading(true);

    try {
      await authFn(auth, emailParam, passwordParam);
      toast({ title: successMessage});
      // onAuthStateChanged yönlendirmeyi halledecek
    } catch (err: any) {
      let friendlyMessage = "Bir hata oluştu.";
      if (err.code === 'auth/invalid-email') {
        friendlyMessage = 'Geçersiz e-posta formatı.';
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        friendlyMessage = 'Yanlış e-posta veya şifre.';
      } else if (err.code === 'auth/email-already-in-use') {
        friendlyMessage = 'Bu e-posta zaten kullanılıyor.';
      } else if (err.code === 'auth/weak-password') {
        friendlyMessage = 'Şifre en az 6 karakter olmalıdır.';
      }
      
      setError(friendlyMessage);
      
      // Sadece beklenen kullanıcı hataları dışında konsola yazdır
      if (err.code !== 'auth/invalid-credential' && err.code !== 'auth/user-not-found' && err.code !== 'auth/wrong-password') {
        console.error(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Tabs defaultValue="login" className="w-full max-w-md">
        <Card className="bg-secondary/50 backdrop-blur-lg border-border/50 shadow-2xl">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <AuraLogo className="w-12 h-12 mr-3"/>
              <h1 className="text-4xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Aura</h1>
            </div>
            <TabsList className="grid w-full grid-cols-2 bg-muted/50">
              <TabsTrigger value="login">Giriş Yap</TabsTrigger>
              <TabsTrigger value="register">Kayıt Ol</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <div className="p-3 text-sm text-center text-red-200 bg-red-800/50 rounded-md border border-red-500/50">{error}</div>}
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-1">E-posta</label>
                  <Input type="email" id="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-muted-foreground mb-1">Şifre</label>
                  <Input type="password" id="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Giriş Yap'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label htmlFor="register-email" className="block text-sm font-medium text-muted-foreground mb-1">E-posta</label>
                  <Input type="email" id="register-email" required value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="register-password" className="block text-sm font-medium text-muted-foreground mb-1">Şifre</label>
                  <Input type="password" id="register-password" required value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} />
                </div>
                <Button type="submit" variant="secondary" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Kayıt Ol'}
                </Button>
              </form>
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
