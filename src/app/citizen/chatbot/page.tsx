'use client';

import { ChatbotPageShell } from '@/components/chatbot-page-shell';

export default function ChatbotPage() {
  return (
    <div className="fixed inset-x-0 top-16 bottom-20 md:static md:inset-auto md:mx-auto md:my-4 md:max-w-4xl md:h-[calc(100vh-11rem)] flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 md:rounded-2xl md:border md:border-slate-200 md:shadow-lg dark:md:border-slate-800 z-10">
      <div className="flex-1 min-h-0 w-full flex flex-col overflow-hidden">
        <ChatbotPageShell />
      </div>
    </div>
  );
}



