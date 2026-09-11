'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser, useDoc, useMemoFirebase, useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { User as UserType } from '@/lib/types';
import { NotificationToggleRow } from '@/components/push-notification-prompt';
import LanguageSelector from '@/components/translation/language-selector';
import { Star, ShieldCheck, Globe, Bell, Mail, User as UserIcon } from 'lucide-react';

const profileSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters.'),
});
type ProfileForm = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserType>(userDocRef);

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: '' },
  });

  useEffect(() => {
    if (userProfile) {
      form.reset({ displayName: userProfile.name ?? user?.displayName ?? '' });
    }
  }, [userProfile, user, form]);

  async function onSubmit(values: ProfileForm) {
    if (!userDocRef) return;
    setIsUpdating(true);
    try {
      await updateDoc(userDocRef, { name: values.displayName });
      toast({ title: 'Profile Updated', description: 'Your display name has been changed.' });
    } catch {
      toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update your profile.' });
    } finally {
      setIsUpdating(false);
    }
  }

  const isLoading = isAuthLoading || isProfileLoading;

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-48 w-full rounded-2xl md:col-span-1" />
          <Skeleton className="h-80 w-full rounded-2xl md:col-span-3" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4">
        <Card className="text-center p-8">
          <CardTitle>Please log in</CardTitle>
          <CardDescription>You need to be logged in to view your profile.</CardDescription>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 pb-8 space-y-4">

      {/* ── Page header ── */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-5 text-white shadow-md">
        <p className="text-xs font-medium text-white/50 uppercase tracking-widest mb-1">Account</p>
        <h1 className="text-xl font-bold tracking-tight">Profile &amp; Settings</h1>
        <p className="text-sm text-white/60 mt-0.5">Manage your civic identity</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">

        {/* ── Sidebar card ── */}
        <div className="md:col-span-1">
          <Card className="border border-slate-100 shadow-none">
            <CardContent className="pt-6 flex flex-col items-center text-center gap-1">
              <Avatar className="h-20 w-20 ring-2 ring-emerald-100 ring-offset-2 mb-2">
                <AvatarImage src={user.photoURL ?? ''} alt={user.displayName ?? 'User'} />
                <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-xl font-bold">
                  {userProfile?.name?.charAt(0).toUpperCase() ?? 'U'}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-base font-bold leading-tight">{userProfile?.name ?? user.displayName}</h2>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <Separator className="my-3 w-full" />
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 w-full justify-center">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <div>
                  <p className="text-lg font-bold leading-none text-amber-700">{userProfile?.points ?? 0}</p>
                  <p className="text-[10px] text-amber-600 font-medium">Total Points</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Tabs ── */}
        <div className="md:col-span-3">
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="w-full grid grid-cols-3 mb-4 h-10 rounded-xl bg-slate-100 p-1">
              <TabsTrigger value="profile" className="rounded-lg text-xs font-medium">Profile</TabsTrigger>
              <TabsTrigger value="security" className="rounded-lg text-xs font-medium">Security</TabsTrigger>
              <TabsTrigger value="settings" className="rounded-lg text-xs font-medium">Settings</TabsTrigger>
            </TabsList>

            {/* Profile tab */}
            <TabsContent value="profile">
              <Card className="border border-slate-100 shadow-none">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                          <UserIcon className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-sm">Public Profile</CardTitle>
                          <CardDescription className="text-xs">How others see you on the platform.</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="displayName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Display Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Your display name" className="h-10 rounded-xl" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-xs font-medium">Email Address</Label>
                        <Input
                          id="email"
                          defaultValue={user.email ?? ''}
                          disabled
                          className="h-10 rounded-xl bg-slate-50 text-muted-foreground"
                        />
                      </div>
                    </CardContent>
                    <CardFooter className="pt-2">
                      <Button
                        type="submit"
                        disabled={isUpdating}
                        className="rounded-xl h-9 px-5 text-sm font-medium"
                      >
                        {isUpdating ? 'Saving…' : 'Save Changes'}
                      </Button>
                    </CardFooter>
                  </form>
                </Form>
              </Card>
            </TabsContent>

            {/* Security tab */}
            <TabsContent value="security">
              <Card className="border border-slate-100 shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-green-50 flex items-center justify-center">
                      <ShieldCheck className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">Security</CardTitle>
                      <CardDescription className="text-xs">Account security settings.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <ShieldCheck className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      You are signed in with Google. Your account security is managed by your Google account.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Language</CardTitle>
                  <CardDescription>Select your preferred app language.</CardDescription>
                </CardHeader>
                <CardContent>
                  <LanguageSelector />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings tab */}
            <TabsContent value="settings" className="space-y-3">

              {/* Notifications card */}
              <Card className="border border-slate-100 shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
                      <Bell className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">Notifications</CardTitle>
                      <CardDescription className="text-xs">Manage how you receive updates.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                        <Mail className="h-4 w-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Email Notifications</p>
                        <p className="text-xs text-muted-foreground">Updates about your reports via email.</p>
                      </div>
                    </div>
                    <Switch id="email-notifications" defaultChecked />
                  </div>
                  <NotificationToggleRow />
                </CardContent>
              </Card>

              {/* Language card */}
              <Card className="border border-slate-100 shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-sky-50 flex items-center justify-center">
                      <Globe className="h-4 w-4 text-sky-600" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">Language</CardTitle>
                      <CardDescription className="text-xs">Choose your preferred display language.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                    <div>
                      <p className="text-sm font-medium">App Language</p>
                      <p className="text-xs text-muted-foreground">Translate the app into your language.</p>
                    </div>
                    <LanguageSelector />
                  </div>
                </CardContent>
              </Card>

            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
