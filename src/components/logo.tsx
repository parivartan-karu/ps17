import { cn } from '@/lib/utils';
import * as React from 'react';

export function Logo({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-6 w-6', className)}
      {...props}
    >
      <path d="M4 17.5a2.5 2.5 0 0 1 5 0" />
      <path d="M4 12.5a2.5 2.5 0 0 1 5 0" />
      <path d="M14 8.5a2.5 2.5 0 0 1 5 0" />
      <path d="M14 13.5a2.5 2.5 0 0 1 5 0" />
      <path d="M4 15h16" />
      <path d="M4 10h16" />
    </svg>
  );
}
