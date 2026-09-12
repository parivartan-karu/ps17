import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock3, HardHat, ShieldCheck, UserRound } from 'lucide-react';

const stages = [
  { title: '1. Citizen', text: 'Submit a real complaint with description, photo and location.', href: '/citizen/report', icon: UserRound },
  { title: '2. AI Triage', text: 'Watch classification, routing, priority, difficulty, duplicate checks and coordination.', href: '/dept/dashboard', icon: CheckCircle2 },
  { title: '3. Worker', text: 'Open an eligible Easy/Moderate task, accept it, upload before/after evidence and submit for verification.', href: '/worker/open-tasks', icon: HardHat },
  { title: '4. Verification', text: 'Department verifies the completion evidence and either approves or requests rework.', href: '/dept/complaints', icon: ShieldCheck },
  { title: '5. SLA & Escalation', text: 'Run the SLA monitor for warnings and automatic L1/L2 escalation.', href: '/dept/dashboard', icon: Clock3 },
];

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">PS17 Demo</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">End-to-end municipal workflow</h1>
        <p className="mt-3 max-w-3xl text-slate-600">Run the same complaint through the actual application: citizen submission → multi-agent triage → department queue → worker execution → evidence verification → SLA monitoring → escalation → citizen resolution.</p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {stages.map(({ title, text, href, icon: Icon }) => (
            <Link key={title} href={href} className="group rounded-xl border bg-white p-5 transition hover:border-slate-400 hover:shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-slate-950"><Icon className="h-5 w-5" /><span className="font-semibold">{title}</span></div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 text-slate-400 transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 rounded-xl border bg-white p-5">
          <h2 className="font-semibold text-slate-950">Recommended demo order</h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-600">
            <li>1. Submit an easy streetlight/pothole complaint.</li>
            <li>2. Open the Worker queue and select the task. Confirm Priority + Difficulty are visible.</li>
            <li>3. Accept → upload before proof → perform work → upload after proof → Submit for Verification.</li>
            <li>4. Department approves. Citizen sees the resolved status.</li>
            <li>5. Repeat with a deliberately overdue complaint to demonstrate SLA escalation.</li>
            <li>6. Finish with the burst-pipe complaint to demonstrate coordinated department tasks.</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
