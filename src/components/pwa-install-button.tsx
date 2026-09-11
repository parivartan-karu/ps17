'use client';

import { useEffect, useState } from 'react';
import { Download, Smartphone, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAInstallButtonProps {
  variant?: 'citizen' | 'worker';
  className?: string;
}

export function PWAInstallButton({ variant = 'citizen', className = '' }: PWAInstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isInStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                          (window.navigator as any).standalone === true;
    setIsInstalled(isInStandalone);

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
  };

  // Colors based on variant
  const colors = variant === 'worker' 
    ? {
        gradient: 'from-amber-500 to-orange-500',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        ring: 'ring-amber-500/20',
      }
    : {
        gradient: 'from-emerald-500 to-green-600',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        ring: 'ring-emerald-500/20',
      };

  // Don't show if already installed
  if (isInstalled) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${colors.bg} ${colors.text} text-sm font-medium ${className}`}>
        <Check className="h-4 w-4" />
        <span>App Installed</span>
      </div>
    );
  }

  // Show install button only if prompt is available or on iOS
  if (!deferredPrompt && !isIOS) {
    return null;
  }

  return (
    <>
      <Button
        onClick={handleInstallClick}
        className={`flex items-center gap-2 bg-gradient-to-r ${colors.gradient} text-white hover:opacity-90 shadow-lg hover:shadow-xl transition-all duration-200 ${className}`}
        size="sm"
      >
        <Download className="h-4 w-4" />
        <span>Install App</span>
      </Button>

      {/* iOS Installation Guide Dialog */}
      <Dialog open={showIOSGuide} onOpenChange={setShowIOSGuide}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className={`h-5 w-5 ${colors.text}`} />
              Install on iOS
            </DialogTitle>
            <DialogDescription>
              Follow these steps to install the app on your iPhone or iPad:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-r ${colors.gradient} text-white flex items-center justify-center text-sm font-bold`}>
                1
              </div>
              <div>
                <p className="font-medium">Tap the Share button</p>
                <p className="text-sm text-muted-foreground">Look for the share icon (square with arrow) at the bottom of Safari</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-r ${colors.gradient} text-white flex items-center justify-center text-sm font-bold`}>
                2
              </div>
              <div>
                <p className="font-medium">Scroll down and tap "Add to Home Screen"</p>
                <p className="text-sm text-muted-foreground">You may need to scroll to find this option</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-r ${colors.gradient} text-white flex items-center justify-center text-sm font-bold`}>
                3
              </div>
              <div>
                <p className="font-medium">Tap "Add" to confirm</p>
                <p className="text-sm text-muted-foreground">The app will appear on your home screen</p>
              </div>
            </div>
          </div>
          <Button onClick={() => setShowIOSGuide(false)} className={`w-full bg-gradient-to-r ${colors.gradient}`}>
            Got it!
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Floating install banner for bottom of screen
export function PWAInstallBanner({ variant = 'citizen' }: { variant?: 'citizen' | 'worker' }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const storageKey = `smc-pwa-banner-dismissed-${variant}`;

  useEffect(() => {
    const isInStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                          (window.navigator as any).standalone === true;
    setIsInstalled(isInStandalone);

    const wasDismissed = localStorage.getItem(storageKey) === 'true';
    setDismissed(wasDismissed);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show banner after 5 seconds if not dismissed
      if (!wasDismissed && !isInStandalone) {
        setTimeout(() => setShowBanner(true), 5000);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowBanner(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [storageKey]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setShowBanner(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem(storageKey, 'true');
  };

  if (isInstalled || dismissed || !showBanner || !deferredPrompt) {
    return null;
  }

  const colors = variant === 'worker' 
    ? {
        gradient: 'from-amber-500 to-orange-500',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
      }
    : {
        gradient: 'from-emerald-500 to-green-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
      };

  const appName = variant === 'worker' ? 'Parivartan Worker' : 'Parivartan Citizen';

  return (
    <div className={`fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 ${colors.bg} ${colors.border} border rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom duration-500`}>
      <button 
        onClick={handleDismiss}
        className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md hover:bg-gray-100 transition-colors"
      >
        <X className="h-4 w-4 text-gray-500" />
      </button>
      
      <div className="flex items-center gap-3">
        <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center shadow-lg`}>
          <Smartphone className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm">Install {appName}</h3>
          <p className="text-xs text-gray-600 truncate">Add to home screen for quick access</p>
        </div>
      </div>
      
      <div className="flex gap-2 mt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="flex-1 text-gray-600"
        >
          Not now
        </Button>
        <Button
          size="sm"
          onClick={handleInstall}
          className={`flex-1 bg-gradient-to-r ${colors.gradient} text-white`}
        >
          <Download className="h-4 w-4 mr-1" />
          Install
        </Button>
      </div>
    </div>
  );
}
