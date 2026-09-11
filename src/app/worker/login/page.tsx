'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, HardHat, Loader2, Hash, Lock, ArrowRight, LogIn, Phone } from 'lucide-react';
import Link from 'next/link';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

import { useAuth, useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function WorkerLoginPage() {
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();

  const [workerId, setWorkerId] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { if (user) router.push('/worker/dashboard'); }, [user, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!workerId.trim() || !password) return;
    setIsLoading(true);
    try {
      // Step 1 — resolve employee ID → email via server (no sensitive data exposed)
      const res = await fetch('/api/worker/login-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId: workerId.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok || !data?.email) throw new Error(data?.error ?? 'Employee ID not found.');

      // Step 2 — sign in with email + password
      const cred = await signInWithEmailAndPassword(auth, data.email, password);

      // Step 3 — verify role
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      if (snap.data()?.role !== 'worker') {
        await signOut(auth);
        throw new Error('This account does not have worker access.');
      }

      // Step 4 — create server session cookie
      const idToken = await cred.user.getIdToken();
      await fetch('/api/worker/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken }),
      });

      toast({ title: '👷 Welcome back!' });
      router.push('/worker/dashboard');
    } catch (err: any) {
      const msg = err.code === 'auth/invalid-credential'
        ? 'Wrong password.'
        : err.code === 'auth/too-many-requests'
          ? 'Too many attempts. Try again later.'
          : err.message ?? 'Login failed.';
      toast({ title: 'Login failed', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-orange-50 via-white to-amber-50">
      {/* ─── Left brand panel (desktop) ──────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-center w-2/5 bg-gradient-to-br from-orange-600 to-amber-700 p-12 text-white">
        <div className="flex items-center gap-3 mb-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
            <HardHat className="h-8 w-8" />
          </div>
          <div>
            <p className="text-3xl font-black">Parivartan</p>
            <p className="text-orange-200 text-sm">Field Worker Portal</p>
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-3 leading-snug">
          Your tasks.<br />Your city. Your impact.
        </h2>
        <p className="text-orange-200 text-sm leading-relaxed mb-8">
          View assigned complaints, upload before/after proof, self-assign open tasks, and track
          your performance — all from your phone.
        </p>
        <div className="space-y-3">
          {[
            '📋 View & manage assigned tasks',
            '📸 Upload before/after work proof',
            '🗺️ GPS navigation to job site',
            '⭐ Track your performance & ratings',
          ].map(f => (
            <div key={f}
              className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2.5 text-sm text-orange-100">
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* ─── Right form ──────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600">
              <HardHat className="h-5 w-5 text-white" />
            </div>
            <p className="text-xl font-black text-gray-900">Worker Portal</p>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Field Worker Sign In</h1>
          <p className="text-sm text-gray-500 mb-8">Enter your employee ID and password to continue.</p>

          <div className="rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-amber-600" />
            <form onSubmit={handleLogin} className="p-8 space-y-5">
              {/* Employee ID */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Employee ID</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="e.g. PMC001"
                    className="pl-10 h-11 rounded-xl border-gray-200 focus-visible:ring-orange-500 uppercase tracking-wider"
                    value={workerId}
                    onChange={e => setWorkerId(e.target.value)}
                    autoCapitalize="characters"
                    required
                  />
                </div>
                <p className="text-xs text-gray-400">
                  Contact your supervisor if you don't know your ID.
                </p>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pl-10 pr-10 h-11 rounded-xl border-gray-200 focus-visible:ring-orange-500"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600
                           hover:from-orange-600 hover:to-amber-700 text-white font-semibold
                           text-base shadow-md"
              >
                {isLoading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>
                  : <><LogIn className="mr-2 h-4 w-4" />Sign In</>
                }
              </Button>
            </form>
          </div>

          <div className="mt-6 flex justify-center gap-4 text-xs text-gray-400">
            <Link href="/citizen/login"
              className="hover:text-emerald-600 transition-colors flex items-center gap-1">
              Citizen Portal <ArrowRight className="h-3 w-3" />
            </Link>
            <Link href="/dept/login"
              className="hover:text-indigo-600 transition-colors flex items-center gap-1">
              Dept Portal <ArrowRight className="h-3 w-3" />
            </Link>
            <Link href="/smc/login"
              className="hover:text-purple-600 transition-colors flex items-center gap-1">
              SMC Admin <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
