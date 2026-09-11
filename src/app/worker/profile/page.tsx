'use client';

import { useEffect, useMemo, useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { CheckCircle, Clock, HardHat, KeyRound } from 'lucide-react';

import { useAuth, useUser } from '@/firebase';
import LanguageSelector from '@/components/translation/language-selector';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

type PerformanceSummaryPayload = {
  summary?: {
    resolved?: number;
    averageResolutionHours?: number;
  };
};

export default function WorkerProfilePage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [completedTasks, setCompletedTasks] = useState(0);
  const [avgHours, setAvgHours] = useState<number | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  const isEmailPasswordUser = useMemo(() => {
    return !!user?.providerData?.some((provider) => provider.providerId === 'password');
  }, [user]);

  useEffect(() => {
    let mounted = true;

    async function loadStats() {
      try {
        const response = await fetch('/api/worker/performance-summary', {
          method: 'GET',
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Unable to load worker stats.');

        const data = (await response.json()) as PerformanceSummaryPayload;
        if (!mounted) return;

        setCompletedTasks(data.summary?.resolved ?? 0);
        setAvgHours(typeof data.summary?.averageResolutionHours === 'number' ? data.summary.averageResolutionHours : null);
      } catch {
        if (!mounted) return;
        setCompletedTasks(0);
        setAvgHours(null);
      } finally {
        if (mounted) setIsStatsLoading(false);
      }
    }

    if (user) loadStats();
    else setIsStatsLoading(false);

    return () => {
      mounted = false;
    };
  }, [user]);

  async function handleChangePassword(event: React.FormEvent) {
    event.preventDefault();

    if (!auth || !user || !user.email) return;

    if (!isEmailPasswordUser) {
      toast({
        variant: 'destructive',
        title: 'Password change not available',
        description: 'This account does not use email-password sign-in.',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Invalid new password',
        description: 'Password must be at least 6 characters.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Password mismatch',
        description: 'New password and confirm password do not match.',
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      toast({
        title: 'Password updated',
        description: 'Your password was changed successfully.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Password change failed',
        description: error instanceof Error ? error.message : 'Please verify current password and try again.',
      });
    } finally {
      setIsChangingPassword(false);
    }
  }

  if (isUserLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Please log in</CardTitle>
          <CardDescription>You need to be logged in to access your worker profile.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-500 to-teal-500 text-white p-6 md:p-8 rounded-lg shadow-lg">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Worker Profile</h1>
        <p className="text-base md:text-lg">Profile settings, language, and password management.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader className="items-center text-center">
            <Avatar className="h-24 w-24 mb-4">
              <AvatarImage src={user.photoURL ?? ''} alt={user.displayName ?? 'Worker'} />
              <AvatarFallback><HardHat /></AvatarFallback>
            </Avatar>
            <CardTitle className="text-2xl">{user.displayName || 'Field Worker'}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center p-4 border-t">
              <p className="font-semibold text-muted-foreground">Role</p>
              <p className="text-lg font-bold text-primary">Field Worker</p>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isStatsLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{completedTasks}</div>}
                <p className="text-xs text-muted-foreground">Resolved tasks from worker performance summary.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Resolution Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isStatsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">{avgHours ?? 'N/A'} {avgHours !== null ? 'hrs' : ''}</div>
                )}
                <p className="text-xs text-muted-foreground">Average time per resolved task.</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Language</CardTitle>
              <CardDescription>Select your preferred app language.</CardDescription>
            </CardHeader>
            <CardContent>
              <LanguageSelector />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Change Password</CardTitle>
              <CardDescription>Update your login password from here.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" disabled={isChangingPassword}>
                  {isChangingPassword ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
