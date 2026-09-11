'use client';

import { ChatbotPageShell } from '@/components/chatbot-page-shell';
import { Bot, MessageSquare, Zap, ShieldCheck } from 'lucide-react';

const features = [
  { icon: MessageSquare, label: 'Natural conversation' },
  { icon: Zap,           label: 'Instant answers'      },
  { icon: ShieldCheck,   label: 'Civic assistance'     },
];

export default function ChatbotPage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950">

      {/* ── Header banner ── */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-5 text-white">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <Bot className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Roadie AI</h1>
              <p className="text-xs text-white/55">Your civic assistant, powered by AI</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            {features.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 rounded-full bg-white/10 border border-white/10 px-3 py-1 text-[11px] font-medium text-white/80"
              >
                <Icon className="h-3 w-3 text-emerald-400" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Chat shell ── */}
      <div className="flex-1 mx-auto w-full max-w-3xl px-0 md:px-4 md:py-4">
        <div className="overflow-hidden md:rounded-2xl md:border md:border-slate-200 md:shadow-sm dark:md:border-slate-800 h-full">
          <ChatbotPageShell />
        </div>
      </div>

    </div>
  );
}
