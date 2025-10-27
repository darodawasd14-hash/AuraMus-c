'use client';
import { useState } from 'react';
import { useAuth } from '@/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuraLogo } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const auth = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        toast({ title: "Logged in successfully!"});
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        toast({ title: "Registered successfully!"});
      }
      // onAuthStateChanged will handle redirect
    } catch (err: any) {
      let friendlyMessage = "An error occurred.";
      if (err.code === 'auth/invalid-email') friendlyMessage = 'Invalid email format.';
      else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') friendlyMessage = 'Incorrect email or password.';
      else if (err.code === 'auth/email-already-in-use') friendlyMessage = 'This email is already in use.';
      else if (err.code === 'auth/weak-password') friendlyMessage = 'Password should be at least 6 characters.';
      setError(friendlyMessage);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="auth-container" className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 bg-opacity-80 backdrop-blur-lg rounded-lg shadow-xl">
        <div className="flex items-center justify-center mb-6">
          <AuraLogo className="w-10 h-10 mr-3"/>
          <h2 className="text-3xl font-bold text-center text-white">Aura Music</h2>
        </div>

        <div className="flex border-b border-gray-700">
          <button onClick={() => setIsLogin(true)} className={`w-1/2 py-3 font-medium ${isLogin ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}>
            Login
          </button>
          <button onClick={() => setIsLogin(false)} className={`w-1/2 py-3 font-medium ${!isLogin ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}>
            Register
          </button>
        </div>

        {error && <div className="p-3 text-sm text-center text-red-200 bg-red-800 rounded-md">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300">Email</label>
            <Input type="email" id="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label htmlFor="password" d="block text-sm font-medium text-gray-300">Password</label>
            <Input type="password" id="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : (isLogin ? 'Login' : 'Register')}
          </Button>
        </form>
      </div>
    </div>
  );
}
