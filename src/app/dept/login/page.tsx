'use client';

import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Building2, Mail, Lock, Loader2, LogIn } from 'lucide-react';
import Link from 'next/link';

import { useAuth, useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function DeptLoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) router.push('/dept/dashboard');
  }, [user, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(firestore, 'users', cred.user.uid));
      const role = userDoc.data()?.role;

      if (role !== 'department_head' && role !== 'official') {
        await signOut(auth);
        throw new Error('This account is not authorized for department access.');
      }

      toast({ title: 'Welcome!', description: 'Logged in to Department Portal.' });
      router.push('/dept/dashboard');
    } catch (err: any) {
      toast({ title: 'Login failed', description: err.message || 'Invalid credentials.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-3xl bg-white shadow-2xl overflow-hidden">
          {/* Top accent */}
          <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-600" />

          <div className="p-8">
            {/* Icon + heading */}
            <div className="flex flex-col items-center mb-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg mb-4">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Department Portal</h1>
              <p className="mt-1 text-sm text-gray-500 text-center">
                Sign in as a department head or assigned officer
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">Official Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="head@dept.pmc.gov.in"
                    className="pl-10 h-11 rounded-xl border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10 h-11 rounded-xl border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold shadow-md text-base"
              >
                {isLoading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>
                  : <><LogIn className="mr-2 h-4 w-4" />Sign In</>
                }
              </Button>
            </form>

            <div className="mt-6 rounded-xl bg-indigo-50 p-4 text-xs text-indigo-700">
              <p className="font-semibold mb-1">ℹ️ Access Info</p>
              <p>This portal is restricted to PMC department heads and designated officers. Your account must be assigned <strong>department_head</strong> role by a system admin.</p>
            </div>

            <div className="mt-4 flex justify-center gap-4 text-xs text-gray-400">
              <Link href="/smc/login" className="hover:text-indigo-600 transition-colors">Admin Portal</Link>
              <span>·</span>
              <Link href="/citizen/login" className="hover:text-emerald-600 transition-colors">Citizen Portal</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
