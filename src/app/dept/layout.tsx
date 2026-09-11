import type { ReactNode } from 'react';
import { DeptSidebar } from '@/components/dept-sidebar';

export default function DeptLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <DeptSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
