'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2, ShieldCheck, Mail, Lock, LogIn, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';

import { useAuth, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SmcLoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { if (user) router.push('/smc/dashboard'); }, [user, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: 'Welcome, Officer.' });
      router.push('/smc/dashboard');
    } catch (err: any) {
      toast({ title: 'Login failed', description: err.code === 'auth/invalid-credential' ? 'Wrong email or password.' : err.message, variant: 'destructive' });
    } finally { setIsLoading(false); }
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-center w-2/5 bg-gradient-to-br from-purple-700 to-indigo-800 p-12 text-white">
        <div className="flex items-center gap-3 mb-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <div>
            <p className="text-3xl font-black">Parivartan</p>
            <p className="text-purple-300 text-sm">Admin Control Panel</p>
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-3">Pune Municipal Corporation<br />Officer Dashboard</h2>
        <p className="text-purple-200 text-sm leading-relaxed mb-8">
          Manage all civic complaints across Pune, assign field workers, send alerts, and track departmental SLAs.
        </p>
        <div className="space-y-3">
          {[
            '📊 Real-time analytics & heatmaps',
            '👷 Worker assignment & tracking',
            '📢 Broadcast city-wide alerts',
            '🤖 AI-assisted complaint triage',
          ].map(f => (
            <div key={f} className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2.5 text-sm text-purple-100">
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-700">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <p className="text-xl font-black text-gray-900">Parivartan Admin</p>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Officer Sign In</h1>
          <p className="text-sm text-gray-500 mb-8">Restricted — authorised PMC officials only.</p>

          <div className="rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-purple-600 to-indigo-600" />
            <form onSubmit={handleLogin} className="p-8 space-y-5">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Official Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input type="email" placeholder="officer@pmc.gov.in"
                    className="pl-10 h-11 rounded-xl border-gray-200 focus-visible:ring-purple-500"
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input type={showPw ? 'text' : 'password'} placeholder="••••••••"
                    className="pl-10 pr-10 h-11 rounded-xl border-gray-200 focus-visible:ring-purple-500"
                    value={password} onChange={e => setPassword(e.target.value)} required />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={isLoading}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold text-base shadow-md">
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</> : <><LogIn className="mr-2 h-4 w-4" />Sign In</>}
              </Button>
            </form>
          </div>

          <div className="mt-6 flex justify-center gap-4 text-xs text-gray-400">
            <Link href="/citizen/login" className="hover:text-emerald-600 transition-colors flex items-center gap-1">Citizen Portal <ArrowRight className="h-3 w-3" /></Link>
            <Link href="/dept/login" className="hover:text-indigo-600 transition-colors flex items-center gap-1">Dept Portal <ArrowRight className="h-3 w-3" /></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
