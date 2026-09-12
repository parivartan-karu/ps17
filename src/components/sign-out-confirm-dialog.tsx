'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SignOutConfirmDialogProps {
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
  triggerClassName?: string;
  variant?: 'ghost' | 'outline' | 'default' | 'destructive';
}

export function SignOutConfirmDialog({
  onConfirm,
  children,
  triggerClassName,
  variant = 'ghost',
}: SignOutConfirmDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {children || (
          <Button
            variant={variant}
            className={triggerClassName || 'h-10 w-full justify-start gap-2.5 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive'}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base font-extrabold flex items-center gap-2 text-slate-900">
            <LogOut className="h-5 w-5 text-rose-600" />
            Confirm Sign Out
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-slate-500 font-medium mt-1">
            Are you sure you want to sign out of your account? You will need to log back in to access the system.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 gap-2">
          <AlertDialogCancel className="rounded-xl border-slate-200 text-xs font-semibold h-9 px-4">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold h-9 px-4 shadow-sm"
          >
            Sign Out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
