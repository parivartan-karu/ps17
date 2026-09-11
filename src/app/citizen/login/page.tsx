'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2, Leaf, Mail, Lock, User, Phone, LogIn, UserPlus, ArrowRight, Camera, MapPin, Bell, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc } from 'firebase/firestore';

import { useAuth, useFirestore, useUser } from '@/firebase';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function InputField({ id, label, type = 'text', placeholder, value, onChange, icon: Icon, required = false, extra }: any) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input id={id} type={isPassword && show ? 'text' : type} placeholder={placeholder}
          className="pl-10 pr-10 h-11 rounded-xl border-gray-200 focus-visible:ring-emerald-500"
          value={value} onChange={onChange} required={required} />
        {isPassword && (
          <button type="button" onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {extra}
    </div>
  );
}

export default function CitizenLoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');

  useEffect(() => { if (user) router.push('/citizen/dashboard'); }, [user, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      toast({ title: 'Welcome back!' });
      router.push('/citizen/dashboard');
    } catch (err: any) {
      toast({ title: 'Login failed', description: err.code === 'auth/invalid-credential' ? 'Wrong email or password.' : err.message, variant: 'destructive' });
    } finally { setIsLoading(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (regPassword !== regConfirm) { toast({ title: "Passwords don't match", variant: 'destructive' }); return; }
    if (regPassword.length < 6) { toast({ title: 'Password too short', description: 'Min 6 characters.', variant: 'destructive' }); return; }
    setIsLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
      await updateProfile(cred.user, { displayName: regName });
      await setDocumentNonBlocking(doc(firestore, 'users', cred.user.uid), {
        id: cred.user.uid, name: regName, email: regEmail, phoneNumber: regPhone,
        role: 'citizen', points: 0, createdAt: new Date().toISOString(),
      });
      toast({ title: 'Account created', description: 'Welcome to Parivartan.' });
      router.push('/citizen/dashboard');
    } catch (err: any) {
      toast({ title: 'Registration failed', description: err.code === 'auth/email-already-in-use' ? 'Email already registered.' : err.message, variant: 'destructive' });
    } finally { setIsLoading(false); }
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Left illustration panel – desktop only */}
      <div className="hidden lg:flex flex-col justify-center items-center w-2/5 bg-gradient-to-br from-emerald-600 to-teal-700 p-12 text-white">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <Leaf className="h-8 w-8" />
          </div>
          <div>
            <p className="text-3xl font-black">Parivartan</p>
            <p className="text-emerald-200 text-sm">Civic Complaint Platform</p>
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-4">Report civic issues,<br />track their resolution.</h2>
        <p className="text-emerald-200 text-sm leading-relaxed mb-8">
          Parivartan connects Pune citizens with the Municipal Corporation. Submit photo-evidenced reports, track them in real-time, and compete on the leaderboard for contributing to a better city.
        </p>
        <div className="grid grid-cols-2 gap-4 w-full">
          {[
            { icon: Camera, label: 'AI-powered photo analysis' },
            { icon: MapPin, label: 'GPS-tagged reports' },
            { icon: Bell, label: 'Real-time push updates' },
            { icon: Trophy, label: 'Leaderboard' },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-2 bg-white/10 rounded-xl p-3 text-sm">
              <f.icon className="h-4 w-4 text-emerald-200 shrink-0" />
              <span className="text-emerald-100">{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600">
              <Leaf className="h-5 w-5 text-white" />
            </div>
            <p className="text-xl font-black text-gray-900">Parivartan</p>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {tab === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            {tab === 'login' ? 'Sign in to continue to your dashboard.' : 'Join Parivartan and start making a difference.'}
          </p>

          {/* Tab switcher */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
            {(['login', 'register'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {t === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <InputField id="email" label="Email" type="email" placeholder="you@example.com" icon={Mail} value={loginEmail} onChange={(e: any) => setLoginEmail(e.target.value)} required />
              <InputField id="password" label="Password" type="password" placeholder="••••••••" icon={Lock} value={loginPassword} onChange={(e: any) => setLoginPassword(e.target.value)} required />
              <Button type="submit" disabled={isLoading}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base mt-2">
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</> : <><LogIn className="mr-2 h-4 w-4" />Sign In</>}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <InputField id="name" label="Full Name" placeholder="Aditya Suryawanshi" icon={User} value={regName} onChange={(e: any) => setRegName(e.target.value)} required />
              <InputField id="reg-email" label="Email" type="email" placeholder="you@example.com" icon={Mail} value={regEmail} onChange={(e: any) => setRegEmail(e.target.value)} required />
              <InputField id="phone" label="Mobile Number" placeholder="+91 98765 43210" icon={Phone} value={regPhone} onChange={(e: any) => setRegPhone(e.target.value)} required />
              <InputField id="reg-password" label="Password" type="password" placeholder="Min 6 characters" icon={Lock} value={regPassword} onChange={(e: any) => setRegPassword(e.target.value)} required />
              <InputField id="reg-confirm" label="Confirm Password" type="password" placeholder="Repeat password" icon={Lock} value={regConfirm} onChange={(e: any) => setRegConfirm(e.target.value)} required />
              <Button type="submit" disabled={isLoading}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base mt-2">
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account…</> : <><UserPlus className="mr-2 h-4 w-4" />Create Account</>}
              </Button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col gap-2">
            <p className="text-center text-xs text-gray-400">
              By continuing you agree to our{' '}
              <Link href="/terms" className="underline hover:text-emerald-600">Terms</Link> &{' '}
              <Link href="/privacy" className="underline hover:text-emerald-600">Privacy Policy</Link>
            </p>
            <div className="flex justify-center gap-4 text-xs text-gray-400 mt-1">
              <Link href="/smc/login" className="hover:text-purple-600 transition-colors flex items-center gap-1">SMC Admin <ArrowRight className="h-3 w-3" /></Link>
              <Link href="/worker/login" className="hover:text-orange-600 transition-colors flex items-center gap-1">Field Worker <ArrowRight className="h-3 w-3" /></Link>
              <Link href="/dept/login" className="hover:text-indigo-600 transition-colors flex items-center gap-1">Department <ArrowRight className="h-3 w-3" /></Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
