'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Menu, LogOut, Shield, ChevronRight } from 'lucide-react';
import { smcNavItems } from '@/lib/nav-items';
import { cn } from '@/lib/utils';
import UserNav from './user-nav';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

export default function SmcSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push('/');
    toast({
      title: 'Logged Out',
      description: 'You have been successfully logged out.',
    });
  };

  const navContent = (
    <nav className="flex flex-col gap-0.5 px-2.5">
      {smcNavItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200',
              isActive 
                ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <span className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
              isActive ? 'bg-white/20' : 'bg-muted group-hover:bg-background'
            )}>
              {item.icon}
            </span>
            <span className="flex-1">{item.label}</span>
            {isActive && <ChevronRight className="h-4 w-4 opacity-70" />}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden w-64 border-r bg-card md:block">
        <div className="flex h-full max-h-screen flex-col">
          {/* Header */}
          <div className="flex h-14 items-center gap-2.5 border-b px-4">
            <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-center shrink-0">
              <Image
                src="/logo.png"
                alt="PMC Admin Logo"
                width={36}
                height={36}
                className="object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-bold tracking-tight">PMC Admin</span>
              <span className="text-xs text-muted-foreground">Control Panel</span>
            </div>
          </div>
          
          {/* Navigation */}
          <div className="flex-1 overflow-y-auto py-3">
            {navContent}
          </div>
          
          {/* Footer */}
          <div className="space-y-2.5 border-t p-3">
            <div className="flex items-center gap-2.5 rounded-lg bg-muted/50 p-2.5">
              <UserNav />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">Administrator</p>
                <p className="text-xs text-muted-foreground">Manage system</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              className="h-10 w-full justify-start gap-2.5 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
      
      {/* Mobile Header */}
      <header className="flex h-14 items-center justify-between gap-3 border-b bg-card px-3.5 md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-64 flex-col p-0">
            <SheetHeader className="border-b px-4 py-3">
              <SheetTitle className="flex items-center gap-3">
                <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-center shrink-0">
                  <Image
                    src="/logo.png"
                    alt="PMC Admin Logo"
                    width={36}
                    height={36}
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-[13px] font-bold">PMC Admin</span>
                  <span className="text-xs text-muted-foreground font-normal">Control Panel</span>
                </div>
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto py-3">
              {navContent}
            </div>
            <div className="border-t p-3">
              <Button 
                variant="ghost" 
                className="h-10 w-full justify-start gap-2.5 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        
        <div className="flex items-center gap-1.5">
          <div className="relative h-8 w-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm flex items-center justify-center shrink-0">
            <Image
              src="/logo.png"
              alt="PMC Admin Logo"
              width={32}
              height={32}
              className="object-cover"
            />
          </div>
          <span className="text-sm font-semibold">PMC Admin</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
          </Button>
          <UserNav />
        </div>
      </header>
    </>
  );
}
